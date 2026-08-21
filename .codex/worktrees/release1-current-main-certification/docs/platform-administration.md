# Platform administration

Platform access is separate from company membership. A user retains their
existing company role and `companyId`; the nullable `platformRole` grants an
additional, explicitly authorized SaaS-level scope.

## Roles and authorization

- `PLATFORM_SUPPORT` has read-only platform access.
- `PLATFORM_ADMIN` adds routine operational administration.
- `PLATFORM_OWNER` has full platform access, including platform-role changes,
  administrator management, high-risk configuration, and global audit logs.

Every platform page and API must call the centralized server-side helper in
`src/lib/auth/platform-authorization.ts`. It first validates the normal
database-backed session and then reloads the user from PostgreSQL. The user
must be active, email-verified, and have an allowed `platformRole`. Navigation
visibility is only a convenience and never grants access.

Normal tenant repositories remain scoped by `companyId`. Cross-company reads
belong only in explicitly named platform repositories and must return selected
DTO fields rather than raw user, token, or session records.

## First-owner bootstrap

The bootstrap is a local, manually invoked CLI operation. It never runs during
installation, build, migration, or deployment. It does not create an account,
password, verification record, or session.

1. Register the owner through the normal application flow and verify the
   email address.
2. Store `PLATFORM_OWNER_EMAIL` privately in the intended Vercel environment.
3. Run the command locally with the intended environment loaded securely:

   ```powershell
   vercel env run --environment production -- npm run admin:bootstrap-owner
   ```

4. Sign in through `/login`; do not create a separate platform login path.
5. Verify `/admin` as the owner and verify denial with a normal company user.

The script normalizes the configured email, requires an existing active and
verified user, refuses promotion if another owner exists, and updates the role
with its audit event in one serializable transaction. Re-running it for the
same owner is safe and does not create a duplicate audit event. Output is
limited to success/failure, a shortened user ID, and a partially masked email.

Additional owners and administrators must be managed through authenticated
owner-only operations. The bootstrap command is not a recovery bypass for an
existing owner.

## Operational safety

- Keep `PLATFORM_OWNER_EMAIL` out of source control and logs.
- Never point local test commands at the production database.
- Never expose a permanent bootstrap endpoint.
- Never include password hashes, session tokens, email verification tokens,
  password-reset tokens, database URLs, or provider secrets in admin DTOs or
  audit metadata.
- Apply the checked-in migration with `prisma migrate deploy`; never use
  `prisma migrate reset` against shared environments.
