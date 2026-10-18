import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('preview', Path(__file__).parents[2] / 'scripts/ci/preview_deploy.py')
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)
SHA = 'a' * 40
ENV = {'REVIEWED_SHA': SHA, 'GITHUB_SHA': SHA, 'GITHUB_EVENT_NAME': 'workflow_dispatch',
       'GITHUB_REPOSITORY': p.REPO, 'GITHUB_REF': 'refs/heads/main',
       'PREVIEW_APPROVAL': 'REVIEWED_PREVIEW_ONLY', 'VERCEL_PROJECT_ID': p.PROJECT,
       'VERCEL_ORG_ID': p.TEAM}
PROJECT = {'id': p.PROJECT, 'accountId': p.TEAM, 'name': p.NAME,
           'ssoProtection': {'deploymentType': 'all_except_custom_domains'}}
RUN = {'head_sha': SHA, 'event': 'push', 'head_branch': 'main',
       'path': '.github/workflows/verify.yml', 'run_number': 10,
       'status': 'completed', 'conclusion': 'success'}
URL = 'https://example.vercel.app'
DEPLOYMENT = {'projectId': p.PROJECT, 'ownerId': p.TEAM, 'target': None,
              'url': 'example.vercel.app',
              'meta': {'githubCommitSha': SHA, 'githubCommitRef': 'main'}}


class Gates(unittest.TestCase):
    def test_dispatch_requires_all_exact_context(self):
        self.assertEqual(p.validate_context(ENV), SHA)
        for key, value in [('GITHUB_EVENT_NAME', 'push'), ('GITHUB_REF', 'refs/heads/feature'),
                           ('GITHUB_SHA', 'b' * 40), ('PREVIEW_APPROVAL', ''),
                           ('GITHUB_REPOSITORY', 'fork/better-movie'), ('VERCEL_ORG_ID', 'wrong'),
                           ('VERCEL_PROJECT_ID', 'wrong'), ('REVIEWED_SHA', 'main')]:
            with self.subTest(key=key), self.assertRaises(p.Refuse):
                p.validate_context({**ENV, key: value})

    def test_auto_requires_successful_main_push_workflow_payload(self):
        run = {**RUN, 'name': 'Verify synthetic slice', 'id': 123,
               'head_repository': {'full_name': p.REPO}}
        payload = {'action': 'completed', 'repository': {'full_name': p.REPO},
                   'workflow_run': run}
        with tempfile.TemporaryDirectory() as folder:
            event_file = Path(folder) / 'event.json'
            auto = {**ENV, 'GITHUB_EVENT_NAME': 'workflow_run',
                    'PREVIEW_APPROVAL': '',
                    'GITHUB_EVENT_PATH': str(event_file)}
            event_file.write_text(json.dumps(payload))
            self.assertEqual(p.validate_context(auto), SHA)
            for change in [{'conclusion': 'failure'}, {'status': 'in_progress'},
                           {'event': 'pull_request'}, {'head_branch': 'feature'},
                           {'head_sha': 'b' * 40}, {'name': 'Other workflow'},
                           {'path': '.github/workflows/preview-deploy.yml'},
                           {'head_repository': {'full_name': 'fork/repo'}}]:
                with self.subTest(change=change), self.assertRaises(p.Refuse):
                    event_file.write_text(json.dumps({**payload, 'workflow_run': {**run, **change}}))
                    p.validate_context(auto)
            event_file.write_text(json.dumps(payload))
            with self.assertRaises(p.Refuse):
                p.validate_context({**auto, 'GITHUB_SHA': 'b' * 40})
            with self.assertRaises(p.Refuse):
                p.validate_context({**auto, 'GITHUB_REF': 'refs/heads/feature'})
            with self.assertRaises(p.Refuse):
                p.validate_context({**auto, 'GITHUB_EVENT_PATH': ''})
            event_file.write_text(json.dumps({**payload, 'action': 'requested'}))
            with self.assertRaises(p.Refuse):
                p.validate_context(auto)

    def test_auto_gate_rejects_mismatched_or_stale_verification_run(self):
        run = {**RUN, 'name': 'Verify synthetic slice', 'id': 123,
               'head_repository': {'full_name': p.REPO}}
        payload = {'action': 'completed', 'repository': {'full_name': p.REPO},
                   'workflow_run': run}
        base_responses = [
            {'object': {'sha': SHA}},
            [{'merged_at': '2026-10-18', 'merge_commit_sha': SHA,
              'base': {'ref': 'main', 'repo': {'full_name': p.REPO}}}],
        ]
        tail_responses = [
            {'deployment_branch_policy': {'custom_branch_policies': True, 'protected_branches': False}},
            {'branch_policies': [{'name': 'main', 'type': 'branch'}]},
        ]
        with tempfile.TemporaryDirectory() as folder:
            event_file = Path(folder) / 'event.json'
            event_file.write_text(json.dumps(payload))
            auto = {**ENV, 'GITHUB_EVENT_NAME': 'workflow_run',
                    'PREVIEW_APPROVAL': '', 'GITHUB_EVENT_PATH': str(event_file)}
            for latest_id, expect_ok in [(123, True), (124, False)]:
                responses = base_responses + [{'workflow_runs': [{**RUN, 'id': latest_id}]}] + tail_responses
                with self.subTest(latest_id=latest_id), patch.dict(os.environ, auto, clear=True), \
                     patch.object(p, 'git', side_effect=[SHA, '']), \
                     patch.object(p, 'gh', side_effect=responses):
                    if expect_ok:
                        self.assertEqual(p.gate(), SHA)
                    else:
                        with self.assertRaises(p.Refuse):
                            p.gate()

    def test_latest_main_ci_only(self):
        p.validate_ci([RUN], SHA)
        for change in [{'head_sha': 'b' * 40}, {'event': 'pull_request'},
                       {'path': '.github/workflows/other.yml'}, {'conclusion': 'failure'},
                       {'status': 'in_progress'}]:
            with self.subTest(change=change), self.assertRaises(p.Refuse):
                p.validate_ci([{**RUN, **change}], SHA)
        with self.assertRaises(p.Refuse):
            p.validate_ci([RUN, {**RUN, 'run_attempt': 2, 'conclusion': 'failure'}], SHA)

    def test_existing_project_must_be_protected_and_unlinked(self):
        p.validate_project(PROJECT)
        for change in [{'id': 'new'}, {'accountId': 'other'}, {'name': 'other'},
                       {'ssoProtection': {}}, {'ssoProtection': {'enabled': False, 'deploymentType': 'all'}}, {'ssoProtection': {'deploymentType': 'prod_deployment_urls'}},
                       {'link': {'type': 'github'}}]:
            with self.subTest(change=change), self.assertRaises(p.Refuse):
                p.validate_project({**PROJECT, **change})

    def test_exact_preview_identity(self):
        p.validate_deployment(DEPLOYMENT, SHA, URL)
        for change in [{'target': 'production'}, {'ownerId': 'other'}, {'projectId': 'other'},
                       {'meta': {'githubCommitSha': 'b' * 40, 'githubCommitRef': 'main'}},
                       {'meta': {'githubCommitSha': SHA, 'githubCommitRef': 'feature'}}]:
            with self.subTest(change=change), self.assertRaises(p.Refuse):
                p.validate_deployment({**DEPLOYMENT, **change}, SHA, URL)

    def test_urls_cannot_leak_credentials_or_redirect_off_platform(self):
        self.assertEqual(p.deployment_url(URL), URL)
        for url in ['http://example.vercel.app', URL + '?token=secret', URL + '/api',
                    'https://user:secret@example.vercel.app', 'https://vercel.app.attacker.org',
                    URL + ':443', URL + '#secret']:
            with self.subTest(url=url), self.assertRaises(p.Refuse):
                p.deployment_url(url)

    def test_main_moved_stops_gate(self):
        with patch.dict(os.environ, ENV, clear=True), patch.object(p, 'git', side_effect=[SHA, '']), \
             patch.object(p, 'gh', return_value={'object': {'sha': 'b' * 40}}), self.assertRaises(p.Refuse):
            p.gate()

    def test_full_gate_requires_only_main_environment_rule(self):
        responses = [
            {'object': {'sha': SHA}},
            [{'merged_at': '2026-10-18', 'merge_commit_sha': SHA,
              'base': {'ref': 'main', 'repo': {'full_name': p.REPO}}}],
            {'workflow_runs': [RUN]},
            {'deployment_branch_policy': {'custom_branch_policies': True, 'protected_branches': False}},
            {'branch_policies': [{'name': 'main', 'type': 'branch'}]},
        ]
        for rules, passes in [([{'name': 'main', 'type': 'branch'}], True),
                              ([{'name': '*', 'type': 'branch'}], False),
                              ([{'name': 'main', 'type': 'tag'}], False),
                              ([{'name': 'main'}, {'name': 'feature'}], False), ([], False)]:
            with self.subTest(rules=rules), patch.dict(os.environ, ENV, clear=True), \
                 patch.object(p, 'git', side_effect=[SHA, '']), \
                 patch.object(p, 'gh', side_effect=responses[:-1] + [{'branch_policies': rules}]):
                if passes:
                    self.assertEqual(p.gate(), SHA)
                else:
                    with self.assertRaises(p.Refuse):
                        p.gate()

    def test_direct_push_stops_gate(self):
        with patch.dict(os.environ, ENV, clear=True), patch.object(p, 'git', side_effect=[SHA, '']), \
             patch.object(p, 'gh', side_effect=[{'object': {'sha': SHA}}, []]), self.assertRaises(p.Refuse):
            p.gate()

    def test_protected_smoke_is_explicit_skip_without_secret(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(p, 'request', return_value=(401, b'')):
            self.assertTrue(p.smoke(URL).startswith('SKIPPED'))

    def test_invalid_existing_smoke_credential_fails(self):
        with patch.dict(os.environ, {'VERCEL_AUTOMATION_BYPASS_SECRET': 'test-only'}, clear=True), \
             patch.object(p, 'request', return_value=(403, b'')), self.assertRaises(p.Refuse):
            p.smoke(URL)

    def test_deploy_failure_still_records_without_raw_diagnostics(self):
        with patch.object(p, 'gate', side_effect=p.Refuse('test-only')), patch.object(p, 'record') as record:
            with self.assertRaises(p.Refuse):
                p.deploy()
            self.assertEqual(record.call_args.args[0]['Status'], 'NOT_STARTED')
            self.assertIn('FAILED', record.call_args.args[0]['Runner outcome'])

    def test_read_only_smokes(self):
        responses = [(200, json.dumps({'database': 'connected', 'catalogRevision': 'synthetic-v1'}).encode()),
                     (200, b'<html lang="en">'), (200, b'<html lang="fa" dir="rtl">'),
                     (200, json.dumps({'items': [{'genres': ['drama'], 'runtime': 95}]}).encode())]
        with patch.dict(os.environ, {}, clear=True), patch.object(p, 'request', side_effect=responses) as req:
            self.assertTrue(p.smoke(URL).startswith('PASS'))
            self.assertEqual(len(req.call_args_list), 4)


if __name__ == '__main__':
    unittest.main()
