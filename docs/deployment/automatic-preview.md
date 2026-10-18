# Automatic protected Preview deployment

Status: configured GitHub Actions workflow, standing authorization from repository owner.

## Trigger and scope

After each successful **push** verification of a merged PR on `main`, GitHub's
`.github/workflows/preview-auto.yml` receives a `workflow_run.completed`
event for `Verify synthetic slice`. It deploys exactly that current `main`
commit to the existing protected `frame-movie-discovery` Vercel **Preview**
project. Nothing runs on PR checks, failed/incomplete CI, non-main branches,
unverified direct pushes, or stale `main` commits.

The job reuses `scripts/ci/preview_deploy.py`, the existing Vercel Hobby
project, the existing Neon **Preview** environment variables, and the GitHub
Environment `preview-deploy` with a branch policy limited to `main`.
The `VERCEL_TOKEN` remains an environment secret; never put it in source or
chat. The token itself might have broader privileges, but the reviewed workflow
and runner strictly request Preview and validate target project, team,
protection, Git linkage and deployed metadata.

The workflow does not link Git to Vercel, assign Production domains, promote
deployments, run database migrations or seed Neon, adjust existing
authentication/protection, or activate paid infrastructure. Deployments are
serialized against the optional manual fallback workflow.

## Failure and duplicate handling

Successful CI triggers one automatic job. A manual CI re-run that succeeds may
trigger another Preview for the same SHA. Before approving any manual retry,
inspect Vercel deployments to avoid accidental duplicate builds.
The runner fails closed if the current `main` SHA moves before deployment,
the GitHub event doesn't match the latest passing `main` push verification,
the SHA doesn't belong to a merged PR, the environment has a wildcard branch
policy, or project/protection identity changes.

Each run summary identifies the created deployment, exact SHA, READY/error
status, Preview URL and smoke outcome. Smoke requires the optional existing
`VERCEL_AUTOMATION_BYPASS_SECRET` to pass through Vercel Authentication.
Without it, `SKIPPED` does not mean the application failed: check the protected
Preview in an authenticated browser. Build READY alone is not verification of
live API, Neon availability, mobile latency or Persian layout.

## Where to look

- Automatic workflow: `.github/workflows/preview-auto.yml`
- CI verification: `.github/workflows/verify.yml`
- Read-only gates, deployment and smoke: `scripts/ci/preview_deploy.py`
- Manual fallback: [GitHub Actions Preview guide](github-actions-preview.md)
- GitHub Actions: https://github.com/alisohdev/better-movie/actions
- Vercel project: https://vercel.com/alirezaconstantins-projects/frame-movie-discovery

**Publishing to Production is not included in the standing authorization.**
