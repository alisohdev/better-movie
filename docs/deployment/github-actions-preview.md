# Protected Preview from GitHub Actions (manual fallback)

This workflow targets only the existing `frame-movie-discovery` project
(`prj_K1VfRwHsmRpTpvNsNCDJNhWM8dNT`) in `alirezaconstantins-projects`
(`team_zTb0ZL2P3xsTKB8S0J25ytnZ`). These IDs are public configuration in
`.github/workflows/preview-deploy.yml`, not secrets. Codex Cloud is not the runner
and needs no Vercel login or network change.

## What authorizes a deployment

The manual fallback uses only `workflow_dispatch`. The separate
[`preview-auto.yml`](../../.github/workflows/preview-auto.yml) automatically
deploys the **current main SHA after successful main push verification** via
`workflow_run`. Its guard refuses PR or fork workflows, failed CI, stale main,
direct pushes without a merged PR, and non-Preview Vercel configuration.
Both workflows serialize deployments into the same concurrency group.
Neither workflow can intentionally deploy to Production.

The remaining manual-specific instructions below explain how to run the fallback. The separate
`Preview workflow checks` workflow runs credential-free guard tests on changes;
it cannot deploy.

Select `main` and enter its exact full lowercase 40-character SHA plus
`REVIEWED_PREVIEW_ONLY`. This is your explicit attestation that you reviewed and
approve that exact commit for Preview. It is not approval for Production. The
workflow refuses other refs, stale main SHAs, direct pushes without an associated
merged PR, and missing/failed/incomplete verification CI. It checks the latest
`push` run of `.github/workflows/verify.yml` for this exact SHA, not an older PR's
passing checks. If main moves while queued, it stops and requires a new review
and dispatch. Commit review is a manual attestation here; this workflow does not
claim to enforce independent GitHub review submissions. Main branch protection
and required PR reviews are useful additional repository controls, but this PR
does not change them.

Before submission, it verifies the Vercel API's project ID, team ownership, name,
and Vercel Authentication policy. It refuses a newly connected Git integration,
which would need separate review for automatic Production side effects. It then
writes an exact local CLI link to the existing IDs and runs the pinned CLI with
`--target=preview`, explicit project/team, and committed SHA/branch metadata.
It cannot intentionally select a new project or Production target. A Vercel
token may still have broader privileges: its storage and reviewed workflow code
are the security boundary; the token itself is not necessarily Preview-only.

GitHub hosts one small gate job and one deployment job (5/20 minute limits),
serialized without canceling an in-progress deployment. No containers, browser
installation, paid runner, additional service, or retained artifact is needed.
The existing public repository can use standard GitHub-hosted runners for free;
Vercel Hobby/Neon Free quotas still apply. One manual or automated run creates at most one Preview. Automatic CI reruns can trigger another deployment; check Vercel before retrying unknown outcomes.

Automatic deployments use the existing `preview-deploy` GitHub Environment
and its `VERCEL_TOKEN` secret; no further phone action is required after setup.
See [Automatic Preview deployment](automatic-preview.md) for ongoing behavior.
The following is the one-time setup and manual fallback reference.

## Minimal phone setup — do only after authorization

Use the mobile browser; enable **Desktop site** if GitHub hides Settings or
Environments. Do not paste any token into chat, an issue, a PR, or repository code.

1. Open [Vercel token settings](https://vercel.com/account/settings/tokens).
   Create a token for your account with access limited to
   `alirezaconstantins-projects` where Vercel offers that scope. Use a short
   suitable expiration. It must be allowed to read this project and create its
   Preview deployments. No paid integration is needed.
2. Open [the repository's Environments settings](https://github.com/alisohdev/better-movie/settings/environments).
   Create the GitHub Environment **`preview-deploy`**. This is GitHub configuration,
   not a new Vercel project or a Vercel custom environment.
3. In that Environment, under **Deployment branches and tags**, choose
   **Selected branches and tags**, add a **Branch** rule named exactly **`main`**,
   and keep it as the only rule. The workflow checks this configuration via API
   and refuses wildcard/tag/extra branch rules. Required reviewers may be added
   separately if available, but are not necessary for this manual-attestation
   strategy or its minimal setup.
4. In the same Environment, choose **Add environment secret**. Set the name to
   **`VERCEL_TOKEN`** and paste the Vercel token directly into GitHub's private
   value field. Save. This is the only required secret; no repository variables,
   database URL, team ID secret, or project ID secret are needed. Do not put it
   in repository-wide secrets.
5. Optional: if you already have an authorized Vercel automation bypass
   credential for this project, store it as the Environment secret
   **`VERCEL_AUTOMATION_BYPASS_SECRET`**. Do not create/rotate protection settings
   just for this workflow. Without it, the workflow attempts read-only smoke
   requests and records a clear `SKIPPED` result when Authentication blocks them.

The built-in `github.token` is issued automatically for read-only repository,
Actions, PR, and Environment metadata checks. You do not create a GitHub PAT.
Never copy Neon URLs into GitHub. Leave all existing Vercel Preview variables,
Neon data, Vercel Authentication, and free plans as they are.

## Build, evidence, and smoke behavior

The runner installs Vercel CLI **64.5.0** (with lifecycle scripts disabled) on
Node **24.19.0**. Checkout v4.2.2 and setup-node v4.4.0 are pinned to their release
commit SHAs. CLI help and environment-token handling were inspected for this
version. Changing these pins requires code review. Runner Python is Ubuntu
24.04's provided Python 3; it uses only the standard library.

This intentionally uses a **Vercel remote source build**, rather than a local
`vercel build --prebuilt`: the existing Go function build and project Preview
variables stay on Vercel. The runner never calls `vercel pull`, `env pull`, or
any environment-editing API. The checked-in `vercel.json` continues to build
Astro and discover the Go adapter. No migration or seed is run against Neon.
The separately existing verification workflow uses its own disposable PostgreSQL
service; its fixture setup does not touch Neon.

Deployment submission output is captured privately and withheld from logs. The
script polls the deployment API for up to ten minutes and validates Preview
target, owner, project, URL, branch, and deployed SHA metadata. The source comes
from the clean checkout of that SHA. The **run summary** records only URL, status,
commit SHA, target, deployment ID when known, smoke outcome, and runner failure
when applicable. No raw API response, CLI log, environment file, or authentication
state is uploaded. If the runner is forcibly canceled or killed by GitHub before
its finally block executes, the summary may be incomplete: inspect the Vercel
project before retrying, because submission may already have occurred. A reported
submission/network failure is not proof that no deployment was created.

Read-only smoke requests check Neon health and `synthetic-v1`, English/Persian
HTML (including RTL), and a real filter API query. Credentials go only to the
validated deployment origin; redirects are never followed. An existing optional
bypass credential enables these checks without disabling Vercel Authentication.
An invalid supplied credential, unhealthy DB, wrong result, or failed build fails
the run. If access is blocked without that optional credential, deployment can
be READY while smoke is explicitly SKIPPED; log into Vercel in your browser and
verify the Preview before accepting it. These are smoke tests, not browser E2E,
performance proof, or a Production release.

## Integration and deployment sequence

1. **Technical review only (now):** review PR #1, PR #2, and this independent
   workflow PR. No merge, deployment, secrets, or Vercel setting change is
   authorized by creating this PR. The new PR starts from `main`, modifies no
   application files, and has no dependency on unmerged scripts from #1/#2.
   Main's existing sqlc CI issue is fixed by #1, so its application CI may remain
   red on this independent PR until #1 is merged and this branch updated.
2. **Merge approval boundary:** obtain explicit approval for merging #1, then
   #2, then this workflow PR. Use a merge commit for #1, preserve its branch,
   retarget #2 to main, and wait for its refreshed CI before merging it. Update
   this workflow PR against resulting main, resolve any conflicts, complete
   technical review and wait for both guard CI and full verification CI. Do not
   merge the workflow PR until its final reviewed head is approved. Recheck that
   Vercel still has no Git integration before each integration step. None of
   these merges triggers this Preview workflow.
3. **Secret setup boundary:** obtain approval for the phone setup above. You
   create the restricted GitHub Environment and secret yourself; no secret is
   collected by Codex. This can happen before or after authorized merges, but
   must be complete before a dispatch. It does not authorize deployment.
4. **Preview approval boundary (manual fallback only):** after the final main push verification succeeds, review the resulting SHA if you choose to trigger an extra manual Preview. The automatic workflow already has standing authorization to deploy verified merge commits.
5. For **optional manual fallback only**, in [GitHub Actions](https://github.com/alisohdev/better-movie/actions), open
   **Manual protected Preview → Run workflow**, select **main**, enter the
   approved SHA and **REVIEWED_PREVIEW_ONLY**, then tap **Run workflow**. That
   manual action is the execution approval for one Preview. No deployment is
   started from Codex Cloud. Never dispatch from the workflow PR branch.
6. Open the run summary. Confirm **READY**, the approved **Commit**, and the
   Preview **URL**. If smoke is SKIPPED, sign in through Vercel Authentication
   and check both locales, filters, a detail page, Back navigation, and API
   health before accepting the result. A failed/blocked/unknown run is not an
   accepted release; inspect it before authorizing any retry. No Production
   promotion is part of this sequence.
