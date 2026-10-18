"""Manual Preview runner. No env pull, database writes, production, or API mutations.

The only remote mutation is the explicit `vercel deploy --target=preview` call.
API responses and CLI logs are never printed: they can include sensitive fields.
"""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

REPO = 'alisohdev/better-movie'
PROJECT = 'prj_K1VfRwHsmRpTpvNsNCDJNhWM8dNT'
TEAM = 'team_zTb0ZL2P3xsTKB8S0J25ytnZ'
NAME = 'frame-movie-discovery'
CLI = '64.5.0'


class Refuse(RuntimeError):
    pass


def require(condition, message):
    if not condition:
        raise Refuse(message)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def request(url, token=None, headers=None):
    # No redirects: authorization must never travel to a different origin.
    hdr = {'Accept': 'application/json', 'User-Agent': 'better-movie-preview'}
    hdr.update(headers or {})
    if token:
        hdr['Authorization'] = 'Bearer ' + token
    try:
        with build_opener(NoRedirect()).open(Request(url, headers=hdr), timeout=30) as res:
            return res.status, res.read(4 * 1024 * 1024)
    except HTTPError as err:
        return err.code, b''


def api(url, token):
    status, body = request(url, token)
    require(status == 200, f'API read failed (HTTP {status}); response withheld.')
    return json.loads(body)


def gh(path):
    return api('https://api.github.com/repos/' + REPO + path, os.environ['GH_TOKEN'])


def vercel(path):
    sep = '&' if '?' in path else '?'
    return api('https://api.vercel.com' + path + sep + urlencode({'teamId': TEAM}),
               os.environ['VERCEL_TOKEN'])


def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()


def validate_context(env):
    sha = env.get('REVIEWED_SHA', '')
    require(re.fullmatch('[0-9a-f]{40}', sha) is not None, 'Use a full lowercase commit SHA.')
    require(env.get('GITHUB_EVENT_NAME') == 'workflow_dispatch', 'Manual dispatch required.')
    require(env.get('GITHUB_REPOSITORY') == REPO, 'Unexpected repository.')
    require(env.get('GITHUB_REF') == 'refs/heads/main', 'Dispatch must select main.')
    require(env.get('GITHUB_SHA') == sha, 'Dispatch SHA differs from reviewed SHA.')
    require(env.get('PREVIEW_APPROVAL') == 'REVIEWED_PREVIEW_ONLY', 'Explicit Preview approval required.')
    require(env.get('VERCEL_PROJECT_ID') == PROJECT and env.get('VERCEL_ORG_ID') == TEAM,
            'Unexpected configured project or team.')
    return sha


def validate_ci(runs, sha):
    # Only the named verification workflow's latest push run counts, never a PR
    # run, a different workflow, or an older successful rerun on another SHA.
    matching = [r for r in runs if r.get('head_sha') == sha and r.get('event') == 'push'
                and r.get('head_branch') == 'main' and r.get('path') == '.github/workflows/verify.yml']
    require(bool(matching), 'No main push verification run for this exact commit.')
    latest = max(matching, key=lambda r: (r['run_number'], r.get('run_attempt', 1)))
    require(latest.get('status') == 'completed' and latest.get('conclusion') == 'success',
            'Latest verification run must be completed and successful.')


def gate():
    sha = validate_context(os.environ)
    require(git('rev-parse', 'HEAD') == sha, 'Checkout differs from approved commit.')
    require(not git('status', '--porcelain', '--untracked-files=no'), 'Tracked checkout is dirty.')
    require(gh('/git/ref/heads/main')['object']['sha'] == sha, 'main moved; review and dispatch again.')
    prs = gh('/commits/' + sha + '/pulls?per_page=100')
    require(any(p.get('merged_at') and p['base']['ref'] == 'main'
                and p['base']['repo']['full_name'] == REPO
                and p.get('merge_commit_sha') == sha for p in prs),
            'Commit must be the merge result of a PR into main; direct pushes are refused.')
    runs = gh('/actions/workflows/verify.yml/runs?' + urlencode(
        {'branch': 'main', 'event': 'push', 'head_sha': sha, 'per_page': 100}))
    validate_ci(runs['workflow_runs'], sha)
    environment = gh('/environments/preview-deploy')
    policy = environment.get('deployment_branch_policy') or {}
    require(policy.get('custom_branch_policies') is True and policy.get('protected_branches') is False,
            'preview-deploy must use selected deployment branches.')
    policies = gh('/environments/preview-deploy/deployment-branch-policies?per_page=100')
    rules = policies.get('branch_policies', [])
    require(len(rules) == 1 and rules[0].get('name') == 'main'
            and rules[0].get('type', 'branch') == 'branch',
            'preview-deploy must allow only the main branch.')
    print('Reviewed main SHA, merged PR, and successful verification confirmed: ' + sha)
    return sha


def validate_project(project):
    require(project.get('id') == PROJECT and project.get('accountId') == TEAM
            and project.get('name') == NAME, 'Vercel target identity mismatch.')
    require(project.get('ssoProtection', {}).get('enabled', True) is not False
            and project.get('ssoProtection', {}).get('deploymentType') in
            ('all', 'all_except_custom_domains', 'preview'), 'Vercel Authentication must protect Preview.')
    # This workflow must not coexist silently with Git-triggered production.
    require(not project.get('link'), 'Git integration is connected; re-review deployment safety first.')


def deployment_url(value):
    u = urlsplit(value)
    require(u.scheme == 'https' and u.hostname and u.hostname.endswith('.vercel.app')
            and u.netloc == u.hostname and u.path in ('', '/') and not u.query and not u.fragment,
            'Unexpected deployment URL.')
    return 'https://' + u.hostname


def validate_deployment(d, sha, url):
    require(d.get('projectId', d.get('project', {}).get('id')) == PROJECT,
            'Deployment project mismatch.')
    require(d.get('teamId', d.get('ownerId')) == TEAM, 'Deployment owner mismatch.')
    require(d.get('target') in (None, 'preview'), 'Deployment is not Preview.')
    require(d.get('meta', {}).get('githubCommitSha') == sha, 'Deployed SHA metadata mismatch.')
    require(d.get('meta', {}).get('githubCommitRef') == 'main', 'Deployed branch mismatch.')
    require(deployment_url('https://' + d['url']) == url, 'Deployment URL mismatch.')


def smoke(url):
    secret = os.environ.get('VERCEL_AUTOMATION_BYPASS_SECRET')
    headers = {'x-vercel-protection-bypass': secret} if secret else {}
    status, body = request(url + '/api/health', headers=headers)
    if status in (301, 302, 303, 307, 308, 401, 403) and not secret:
        return 'SKIPPED: protected Preview requires authorized browser verification; no credential supplied.'
    require(status == 200, 'Preview health smoke failed; response withheld.')
    health = json.loads(body)
    require(health.get('database') == 'connected' and health.get('catalogRevision') == 'synthetic-v1',
            'Preview health did not confirm the existing synthetic catalog.')
    for path, lang in [('/en/discover/', 'en'), ('/fa/discover/', 'fa')]:
        status, body = request(url + path, headers=headers)
        require(status == 200 and re.search(rb'lang=["\x27]' + lang.encode() + rb'["\x27]', body)
                and (lang != 'fa' or re.search(rb'dir=["\x27]rtl["\x27]', body)),
                'Locale HTML smoke failed.')
    status, body = request(url + '/api/movies?genres=drama&runtimeMax=110', headers=headers)
    require(status == 200, 'Filter API smoke failed.')
    items = json.loads(body).get('items', [])
    require(items and all('drama' in m['genres'] and m['runtime'] is not None
                          and m['runtime'] <= 110 for m in items), 'Filter results are incorrect.')
    return 'PASS: Neon health, English/Persian HTML, and read-only filter API.'


def record(result):
    # Allowlisted data only. Never retain CLI output, API responses, env, or URLs with query tokens.
    lines = ['### Protected Preview result', '']
    lines.extend(f'- **{key}**: {value}' for key, value in result.items())
    text = '\n'.join(lines) + '\n'
    print(text)
    with open(os.environ.get('GITHUB_STEP_SUMMARY', os.devnull), 'a') as summary:
        summary.write(text)


def deploy():
    result = {'URL': 'not created', 'Status': 'NOT_STARTED',
              'Commit': os.environ.get('GITHUB_SHA', 'unknown'), 'Target': 'preview',
              'Smoke': 'NOT_RUN'}
    try:
        sha = gate()  # Repeat immediately before secret-bearing work, including queued runs.
        require(bool(os.environ.get('VERCEL_TOKEN')), 'Configure the preview-deploy VERCEL_TOKEN secret.')
        require(os.environ.get('VERCEL_CLI_VERSION') == CLI, 'CLI version configuration mismatch.')
        version = subprocess.run(['vercel', '--version'], capture_output=True, text=True, check=True)
        require(version.stdout.strip() == CLI, 'Installed CLI version mismatch.')
        validate_project(vercel('/v9/projects/' + PROJECT))
        # Exact local context prevents CLI auto-linking/creation; API above verifies ownership.
        Path('.vercel').mkdir(exist_ok=True)
        Path('.vercel/project.json').write_text(json.dumps({'projectId': PROJECT, 'orgId': TEAM,
                                                          'projectName': NAME}))
        # Remote build preserves existing Go runtime and Preview-only variables on Vercel.
        # No --prod, env pull, env overrides, migration, or seed command is used.
        cli_env = {k: v for k, v in os.environ.items()
                   if k not in ('GH_TOKEN', 'VERCEL_AUTOMATION_BYPASS_SECRET')}
        completed = subprocess.run(
            ['vercel', 'deploy', '--target=preview', '--scope', TEAM, '--project', PROJECT,
             '--yes', '--non-interactive', '--no-wait',
             '--meta', 'githubCommitSha=' + sha, '--meta', 'githubCommitRef=main'],
            env=cli_env, capture_output=True, text=True, timeout=300)
        # Do not print captured output: errors/build diagnostics may contain secrets.
        candidates = re.findall(r'https://[a-zA-Z0-9.-]+\.vercel\.app/?', completed.stdout)
        if candidates:
            result['URL'] = deployment_url(candidates[-1])
            result['Status'] = 'SUBMITTED'
        require(completed.returncode == 0 and candidates, 'CLI submission failed; raw output withheld.')
        url = result['URL']
        deadline = time.monotonic() + 600
        while time.monotonic() < deadline:
            d = vercel('/v13/deployments/' + urlsplit(url).hostname)
            result['Status'] = d.get('readyState', d.get('status', 'UNKNOWN'))
            result['Deployment ID'] = d['id']
            validate_deployment(d, sha, url)
            result['Commit'] = d['meta']['githubCommitSha']
            if result['Status'] in ('READY', 'ERROR', 'CANCELED', 'BLOCKED'):
                break
            time.sleep(10)
        require(result['Status'] == 'READY', 'Deployment did not reach READY within the polling budget.')
        validate_project(vercel('/v9/projects/' + PROJECT))
        result['Smoke'] = smoke(url)
    except Exception:
        result['Runner outcome'] = 'FAILED (API/CLI diagnostics withheld to protect secrets)'
        raise
    finally:
        record(result)


if __name__ == '__main__':
    try:
        require(len(sys.argv) == 2 and sys.argv[1] in ('gate', 'deploy'), 'Use gate or deploy.')
        gate() if sys.argv[1] == 'gate' else deploy()
    except Refuse as error:
        print('Refused: ' + str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print('Preview runner failed; sensitive diagnostics withheld.', file=sys.stderr)
        sys.exit(1)
