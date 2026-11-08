# Cowan D1 schema mirror

This directory documents the safe, version-controlled mirror of the Cloudflare D1 database: **schema migrations and non-sensitive development fixtures only**. The production database itself, customer/job records, staff emails, password hashes, sessions, login-attempt records, and `.sqlite`/`.db` files must never be committed to GitHub.

## Where to find the staff records in Cloudflare

The configured D1 database is named `cowan-scheduler` (binding `DB`). In the Cloudflare dashboard, open **Workers & Pages → D1 SQL Database → cowan-scheduler → Console**. After applying `migrations/0002_auth.sql`, the staff table is named `users`. To inspect accounts without exposing password hashes, run:

```sql
SELECT id, email, name, active, created_at FROM users ORDER BY id;
```

The repository cannot write directly to your Cloudflare account. Create an example account in the Cloudflare D1 Console only after applying the migration and generating a password hash locally. The repository includes `scripts/hash-password.mjs`; it prompts for no data itself and accepts the password from standard input. Example (replace email/name with a non-production test identity you control, and paste in the generated hash):

```sql
INSERT INTO users (email, name, password_hash)
VALUES ('sample@example.invalid', 'Sample Staff', 'PASTE_LOCALLY_GENERATED_PBKDF2_HASH_HERE');
```

The placeholder is intentionally not a valid hash; do not run the statement until replacing it. Do not use a shared/default password. For a test account that must be able to sign in, generate its unique password hash with the local script and insert the hash directly into the D1 Console. Do not commit the resulting hash or a real staff record to GitHub. You can remove the sample afterward with:

```sql
DELETE FROM users WHERE email = 'sample@example.invalid';
```

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
