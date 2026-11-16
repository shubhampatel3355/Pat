# Pat Michaels OS — mobile app

iOS and Android app for Pat Michaels OS, built with Expo (SDK 58) and run in **Expo Go**. It is a second
front end for the same system as the web app: same backend, same database, same rules.

## How it shares the web app's backend

```
Phone (this app) ──HTTPS + bearer token──▶ Next.js backend (../src) ──▶ PostgreSQL
Browser (web app) ──HTTPS + session cookie──▶        same code        ──▶ same database
```

- **Reads**: each screen loads one endpoint under `/api/mobile/v1/*` (e.g. `/wip`, `/finance`). Each endpoint
  calls the same services as the matching web page, so lists, totals and permissions are identical.
- **Changes**: every create/update/delete goes through `POST /api/mobile/v1/actions/<name>`, which runs the
  web's own server action. Validation, permission checks, audit log entries, notifications and side effects
  (e.g. a WIP row moving to *Invoice Raised* when a proforma is converted) are therefore the same code.
  The list of actions is in `../src/server/mobile/actions.ts`.
- **Existing endpoints** are used directly with the bearer token: notifications (`/api/live`), search
  (`/api/search`), uploads and deletes (`/api/files`), invoice and payslip PDFs, and the finance export.
- **Sign-in** (`/api/mobile/v1/auth/login`) runs the web's credential check: rate limits, deactivated
  accounts, the emailed sign-in code for owners and admins when that is switched on. The app then holds a
  signed token (30 days, renewed while in use). A password change or deactivation signs the app out, just
  like the web.
- **Business helpers** (money and date formatting, financial years, status labels and colours, GST, payroll
  arithmetic) are not copied: the app bundles them straight from `../src/lib`, imported as `@shared/<file>`.
- **Keeping in sync**: data refreshes when a screen opens, when the app returns to the foreground and after
  every change; notifications poll every 15 seconds, as the web shell does.
- **Type contract**: `src/api/types.ts` describes every response. The web project's `pnpm typecheck`
  checks it against the server's types (`../tests/contract/mobile-api.ts`) and fails if they drift apart.

## Run it on your phone

Prerequisites: Node 22.13 or newer, and the **Expo Go** app on the phone (App Store / Play Store).

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code: with the Camera app on iPhone, or from inside Expo Go on Android. Phone and computer
must be on the same network (or use `npx expo start --tunnel`).

### Which server the app talks to

By default the app uses `https://os.patmichaels.com`. **That server must be running a version of the web app
that includes the mobile API** (`/api/mobile/v1`), so deploy the web app first.

To point the app somewhere else:

- **For everyone running this checkout**: copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL`, then
  restart `npx expo start`.
- **On one phone**: on the sign-in screen tap *Server: … · Change*. The app checks `/api/health` before
  saving the address.

For local development, run the web app (`pnpm dev` in the repository root) and use your computer's LAN
address, e.g. `http://192.168.0.115:3000`. `localhost` on a phone is the phone itself.

### Judging speed and smoothness

`npx expo start` runs the JavaScript in development mode, which is much slower (extra checks, no
minification). To feel the app as people will, use production mode:

```bash
npm run start:fast     # npx expo start --no-dev --minify
```

## Feel and motion

- **Vibration** (`src/lib/haptics.ts`): named by meaning — `tap` (buttons), `select` (tabs, chips, segments,
  rows), `toggle` (switches, ticks), `press` (the + button), `success` / `warning` / `error` (outcomes and
  confirmations). Android uses the system haptics engine, so it follows the phone's touch-feedback setting
  and needs no vibration permission; iOS uses the Taptic Engine. People can switch it off under More →
  Vibration (saved on the phone). Confirmation dialogs go through `confirmAlert` (`src/lib/confirm.ts`).
- **Motion** (`src/components/ui/motion.tsx`): presses, the tab and segment pills, sheets (spring up, drag down
  to close), toasts, list rows and progress bars animate on the UI thread with Reanimated, so they stay
  smooth while JavaScript is busy, and they follow the system's Reduce Motion setting.
- **Refresh rate**: the phone decides it. iPhones with ProMotion run apps at up to 120 Hz only when the app
  allows it; Expo Go does, and `ios.infoPlist.CADisableMinimumFrameDurationOnPhone` in `app.json` does the
  same for our own builds. Android phones with 90/120 Hz screens pick the rate themselves (most raise it
  while you scroll or something animates); there is no app setting for it. What the app controls is not
  dropping frames, which is what the UI-thread animations and the virtualised list are for.
- **Long lists**: WIP is virtualised (`ScreenList`), so only the cards on screen are drawn.

## Structure

```
src/app/            Screens (Expo Router). (app)/(tabs) = Home, WIP, Pipeline, Follow-ups, More.
                    *-form.tsx screens open as modal sheets.
src/api/            client.ts (requests + token), queries.ts (data hooks, actions), files.ts (PDFs,
                    uploads, signed links), types.ts (response contract), prisma-enums.ts
src/auth/           Session: token in the device keychain, sign-in, forced password change
src/components/     UI kit (ui/*) in the prototype's style, motion (ui/motion.tsx), tab bar, list rows, toast
src/lib/            Formatting re-exports, web-link → screen mapping, storage, form helpers, haptics
src/theme/          Colours, radii, fonts (Urbanist) from mobile.html
```

## Checks

```bash
npm run typecheck      # TypeScript, including the shared ../src/lib files
npm run export:check   # bundles the app for Android, as Expo Go would load it
npm run deps:check     # every dependency at Expo's latest SDK 58 patch; `npx expo install --fix` updates them
```

## Notes

- Permissions are enforced on the server; the app only hides what the server says isn't available.
- Documents open through 60-second signed links and are shared or saved through the phone's share sheet.
- Uploads accept PDF, images and Office files (the server checks type and size, and virus-scans when ClamAV
  is configured).
- Store builds (App Store / Play Store) use EAS Build: `npx eas-cli@latest build`. Expo Go is for
  development and internal use.
