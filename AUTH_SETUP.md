# Staff sign-in setup and operations

## What the sign-in patch does

- Adds an email/password form to the portal and redirects to the technician dashboard only after the server accepts credentials.
- Stores password hashes and hashed session tokens in D1; the raw password and session token are never written to browser storage.
- Sets a Secure, HttpOnly, SameSite=Strict session cookie with a 12-hour lifetime.
- Requires a valid database-backed session for `dashboard.html` and other protected pages/API routes. `/api/login`, `/api/me`, and `/api/logout` are the deliberate exceptions; each handler validates what it needs.
- Applies a 20-failure/15-minute per-source-IP guard, generic credential errors, origin checks on login/logout, no-store responses, and baseline security response headers.

## Required deployment setup

1. Run the existing and new D1 migrations against both local and production databases. The repository currently has a `migrations_dir` configured; make sure the older schedule schema migration exists in your actual branch/deployment, since only the new auth migration is added here.

   ```sh
   npx wrangler d1 migrations apply cowan-scheduler --local
   npx wrangler d1 migrations apply cowan-scheduler --remote
   ```

2. Create each authorized staff user through a trusted administrator process. No public registration or password-reset endpoint is included. Generate a password hash locally (Node.js 18+):

   ```sh
   read -s -p 'Temporary staff password: ' PASSWORD; printf '\n'; HASH=$(printf '%s' "$PASSWORD" | node scripts/hash-password.mjs); unset PASSWORD
   ```

   Insert only the generated hash into D1, substituting a real staff email, display name, and the generated hash. Do not commit the hash or password into the repository:

   ```sql
   INSERT INTO users (email, name, password_hash) VALUES ('staff@example.com', 'Staff Name', 'pbkdf2_sha256$...');
   ```

   Apply the statement using the Cloudflare dashboard or a securely managed Wrangler D1 command. Do not enable public user self-registration.

3. Deploy the Pages project with Functions enabled and ensure the `DB` binding points at the same D1 database. Test the authentication endpoints over HTTPS; the `__Host-` cookie intentionally requires a secure HTTPS origin.
4. Add Cloudflare WAF/rate limiting for `/api/login` as a second layer. The D1 attempt counter is application-level protection, not a substitute for edge rate limits. Monitor failed logins and prune old `login_attempts`/expired `auth_sessions` periodically.
5. Keep Cloudflare Access in front of the portal if it is already part of the organization’s access policy. This patch provides app-managed credentials and does not implement Cloudflare Access JWT verification. Do not treat an unverified Access header as identity.
6. Configure account recovery and staff offboarding operationally: set `active = 0` to disable a user, revoke their sessions with `DELETE FROM auth_sessions WHERE user_id = ?`, and have an administrator issue a new password hash when needed.

## Important integration note

The checked-in repository did not contain the existing `/api/schedule` or other timetable API handlers even though the browser code calls them. The middleware protects those API paths using the new session cookie, but each deployed handler must still use the same D1 binding and must not bypass authentication. Validate the full timetable workflow in the deployed Pages environment before rollout.
