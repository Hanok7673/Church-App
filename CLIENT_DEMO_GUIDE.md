# Church App client demo

## Recommended demo today

Run `pnpm dev` and open [http://127.0.0.1:3000/](http://127.0.0.1:3000/). This is the complete working Church App currently backed by Supabase and includes the established member, church-admin, super-admin, worship, Bible, fellowship, preparation, notification, notebook, and projector workflows.

Use `ROLE_ACCOUNT_SETUP.md` when demonstrating separate super-admin, church-admin, leader, and member accounts. Do not reuse one browser session for conflicting roles; use separate Chrome profiles or private windows.

## New Expo/Tamagui mobile preview

The parallel Expo application demonstrates the new premium mobile design and the first fully migrated vertical slice:

1. Start the custom API with `pnpm dev:api` after configuring `apps/api/.env` with a custom PostgreSQL connection.
2. Start Expo with `pnpm dev:mobile`.
3. Press `a` for an Android emulator or scan the QR code with an Expo-compatible device. Press `w` only for quick development inspection.

The preview is deliberately mobile-first and includes the compact Tamagui home experience, detailed member registration, private profile fields, optional church choice, and the pending ordinary-member approval model. Selecting a church never grants administrator or super-admin authority. The browser rendering is a development preview of the same phone UI; a dedicated web layout will be designed later.

The mobile workspace intentionally targets Expo SDK 54 because the public Expo Go build on physical iPhones currently supports SDK 54. Start it with `pnpm dev:mobile -- --lan`, keep the terminal open, connect the phone and computer to the same Wi-Fi, and scan the QR from Expo Go. Newer Expo SDKs should be adopted after their matching Expo Go build is available or after the project moves to an EAS development build.

## Honest scope boundary

Do not present the Fastify/PostgreSQL system as the production backend until a separate PostgreSQL target has been provisioned and its migration has run. The existing Supabase-backed app remains the functional demo and source of truth during this controlled migration. No production data was deleted or changed by the monorepo batch.
