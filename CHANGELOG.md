# Changelog

All notable changes to this project in the current branch.

## Unreleased

- chore: remove obsolete `version` key from `docker-compose.yml` to silence Compose warning
- feat: add cross-platform `scripts/setup-dev.js` to install deps, start Docker services, apply DB schema and start dev server detached
- feat: add PowerShell helper `scripts/setup-dev.ps1` (idempotent, applies schema)
- docs: add README section describing the new setup scripts
- chore: upgrade dev tooling (Vitest 4.x, TypeScript updated locally / lockfile updated)

These changes make it easier to bootstrap a local development environment across platforms and keep dev deps up to date.
