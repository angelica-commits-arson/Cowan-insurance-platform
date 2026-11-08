# Staff sign-in setup and operations

## Authentication model

The application uses one app-managed authentication system: staff email/password credentials are checked by Cloudflare Pages Functions against user records in D1. A successful login creates a random server-side session and sets a Secure, HttpOnly, SameSite=Strict cookie. The browser does not store passwords or session tokens. Cloudflare Access is not used as the app identity source; if the organization keeps Access in front as an additional network gate, it is an outer layer, not a second application login.

The middleware protects the dashboard and application API routes. `/api/login`, `/api/me`, and `/api/logout` are the intentionally public auth endpoints; those handlers perform their own checks. Logout invalidates the D1 session and expires the cookie.

The code includes PBKDF2 password-hash verification, generic credential errors, origin checks, no-store responses, and a basic failed-login guard. Configure Cloudflare WAF/rate limits for `/api/login` as a second layer and review security controls before production use.

## Where to find/create a D1 user

In Cloudflare, open **Workers & Pages → D1 SQL Database → cowan-scheduler → Console**. The staff table is `users`; a safe account listing query that does not reveal hashes is:

```sql
SELECT id, email, name, active, created_at FROM users ORDER BY id;
```

To create a sample, first apply the auth migration and generate a unique hash locally. Never store a plaintext password or use a shared default. The `scripts/hash-password.mjs` helper reads the password from standard input and prints a PBKDF2 hash. Then run an insert in the D1 Console using a test email and that hash:

```sql
INSERT INTO users (email, name, password_hash)
VALUES ('sample@example.invalid', 'Sample Staff', 'PASTE_LOCALLY_GENERATED_PBKDF2_HASH_HERE');
```

Replace the placeholder before executing; it is deliberately not a valid hash. The GitHub tools cannot access your Cloudflare account, so this record must be inserted in your D1 Console or through Wrangler with your Cloudflare credentials. Do not commit staff records, password hashes, or database exports to GitHub. Remove the sample with `DELETE FROM users WHERE email = 'sample@example.invalid';` when finished.

## Required deployment setup

1. Apply migrations to the local and production D1 databases:

   ```sh
   npx wrangler d1 migrations apply cowan-scheduler --local
   npx wrangler d1 migrations apply cowan-scheduler --remote
   ```

   Confirm the schedule schema exists too. The repository did not include its existing timetable schema migration, even though the UI calls `/api/schedule`; the auth migration is not a replacement for it.

2. Create each authorized staff user through a trusted administrator process. There is no public registration or password-reset endpoint. Generate a password hash locally (Node.js 18+); enter the password interactively so it is not embedded in source or passed as an argument:

   ```sh
   read -s -p 'Temporary staff password: ' PASSWORD; printf '\n'; HASH=$(printf '%s' "$PASSWORD" | node scripts/hash-password.mjs); unset PASSWORD
   ```

   Insert only the generated hash into D1, replacing the example values. Do not commit the password or hash to GitHub.

3. Deploy the Pages project with the `DB` binding configured to the intended D1 database. Test login, session persistence, logout, and protected page/API access over HTTPS. The `__Host-` cookie requires HTTPS.
4. Disable staff by setting `active = 0`; revoke their sessions with `DELETE FROM auth_sessions WHERE user_id = ?`. Use an administrator-controlled reset process to issue a fresh hash if a password is forgotten.

## Safe GitHub mirror

GitHub contains the database **schema migrations**, not a copy of the live D1 records. See `database/README.md`. Do not commit a D1 dump, production records, personal information, password hashes, sessions, or login-attempt history. The current repository also needs its schedule schema located and added as a migration before the checked-in migrations can reconstruct the full application schema.
