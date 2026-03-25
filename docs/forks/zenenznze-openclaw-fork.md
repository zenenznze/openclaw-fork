# zenenznze/openclaw-fork

Purpose: maintain Joe's long-lived OpenClaw fork for custom auth/profile behavior, starting with planned `openai-codex` multi-profile support.

## Local default location

- Repo path: `/home/joe/data-archive/projects/openclaw-fork`

## Remote layout

- `origin` → `git@github.com:zenenznze/openclaw-fork.git`
- `upstream` → `https://github.com/openclaw/openclaw.git`

## Maintenance policy

- Day-to-day custom work can happen on feature branches off `main`.
- Upstream changes should land through a reviewable PR, not silent direct auto-merge.
- Scheduled workflow: `.github/workflows/upstream-sync.yml`
- Branch used by automation: `chore/sync-upstream`

## Why a fork instead of local patching

Local edits under installed `node_modules` are fragile and disappear on update. A fork keeps:

- commit history
- reviewable diffs
- rebase/merge path against upstream
- a stable home for long-term auth customizations

## First planned customization

- `openai-codex` multi-profile support
- likely shape:
  - explicit profile targeting during login/import, and/or
  - stable non-`default` profile IDs derived from account identity

## Suggested workflow

1. Implement custom behavior on a feature branch.
2. Open PR into this fork's `main`.
3. Let upstream sync land separately via the scheduled sync PR.
4. Reconcile conflicts between custom auth changes and upstream auth changes as needed.

## Notes

- This repo was created on 2026-03-25 as the default long-term home for OpenClaw fork maintenance.
- GitHub account owner: `zenenznze`
