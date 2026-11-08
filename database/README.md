# Cowan D1 schema mirror

This directory documents the safe, version-controlled mirror of the Cloudflare D1 database: **schema migrations and non-sensitive development fixtures only**. The production database itself, customer/job records, staff emails, password hashes, sessions, login-attempt records, and `.sqlite`/`.db` files must never be committed to GitHub.

## Schema source of truth

- D1 binding and migration directory: `wrangler.jsonc`
- Staff-authentication schema: `migrations/0002_auth.sql`
- Add each future schema change as a numbered SQL migration under `migrations/`, then commit it with the application change.

A complete GitHub copy of the live database is neither needed nor safe. Migrations let authorized maintainers rebuild the schema without exposing private data. The repository currently does not contain a schedule-table migration, so do not treat the tracked migrations as a complete production backup until the schedule schema is located and committed as a migration.

## Inspect/apply migrations

Use Wrangler with Cloudflare credentials for an authorized account:

```sh
npx wrangler d1 migrations list cowan-scheduler --remote
npx wrangler d1 migrations apply cowan-scheduler --local
npx wrangler d1 migrations apply cowan-scheduler --remote
```

Keep real records in D1. If a local development fixture is needed, create it from synthetic data, put it in a clearly named development-only SQL file, and never use production exports as fixtures. Before committing SQL, search it for personal information, credentials, password hashes, session tokens, and customer/job details.

## Backups

Use Cloudflare's D1 backup/export tooling and store backups in an approved restricted-access backup location—not a public or broadly accessible source repository. If an encrypted backup is required in GitHub, use a private repository with narrowly scoped access and managed encryption keys; never put the key in the repository or rely on Git history as the only backup. Follow the organization’s retention and recovery policy.
