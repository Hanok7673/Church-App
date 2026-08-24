# Church App monorepo migration

This repository now contains a parallel, type-safe mobile/API architecture while the existing web application remains available during migration.

## Workspaces

- `packages/database`: one Drizzle/PostgreSQL schema, generated SQL migrations, and inferred row/insert types.
- `apps/api`: Fastify REST API with modular plugins, PostgreSQL pooling, authentication, and church-scoped membership routes.
- `apps/mobile`: Expo Router application using Tamagui, React Query, Zustand, and secure device token storage.

## Local setup

1. Install Node.js 22+ and pnpm 10+.
2. Run `pnpm install` at the repository root.
3. Copy `apps/api/.env.example` to `apps/api/.env` and set a private PostgreSQL `DATABASE_URL` and a randomly generated `JWT_SECRET` of at least 32 characters.
4. Copy `apps/mobile/.env.example` to `apps/mobile/.env`. For a physical phone, replace `127.0.0.1` with the development computer's LAN address.
5. Apply the generated database migration with `pnpm db:migrate`.
6. Start the API with `pnpm dev:api` and Expo with `pnpm dev:mobile` in separate terminals.

The Fastify API listens on port `4000` by default. Expo starts its own development server, normally on port `8081`. The legacy web preview remains available with `pnpm dev` on port `3000`.

## Implemented migration slice

- Detailed member signup: name, email, Nepal phone, date of birth, gender, permanent/current address, and optional church choice.
- Sensitive profile fields are stored separately from the public member profile.
- Selecting a church creates only a pending ordinary-member request; it never creates an administrator or super-admin role.
- Church owners/admins can list and approve/reject pending requests only in their own church.
- Approved members appear in the church-scoped directory, which deliberately omits private profile fields.
- Passwords use salted scrypt hashes; short-lived access tokens and one-time rotating refresh sessions replace Supabase Auth for this new stack.

## Migration safety

No Supabase tables or production data were deleted or modified by this batch. The existing application remains the source of truth until a custom PostgreSQL target is provisioned, an audited ETL is run, role-by-role acceptance tests pass, and the cutover is explicitly approved.

## Next batch

Migrate fellowship scheduling, assignments, approval workflows, and role-aware notifications onto the new API and Tamagui screens. Storage-backed audio notes and other binary assets need an object-storage target before their data migration can be completed.
