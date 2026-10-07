# Local development

## First checkout or pull

Install Node.js 24 (also used by CI), npm, and
[Docker Desktop](https://www.docker.com/products/docker-desktop/). Open Docker
Desktop and wait for its engine to start. Phone testing additionally needs a
compatible Expo Go app or an Expo development build. Browser testing does not
need an Expo account.

Commands below name their working directory. The repository root is the folder
containing `README.md`, `apps`, and `supabase`. If your terminal already shows
`mobile`, do not run `cd apps/mobile` again; `pwd` shows your current location.

From the repository root:

```sh
npx --yes supabase start
```

The first start downloads services and applies database migrations. Keep the
printed **publishable key**. To see it again, run `npx --yes supabase status`
from the root. These commands require Docker to keep running.

Then:

```sh
cd apps/mobile
npm ci
```

On first setup only, copy `.env.example` to `.env.local`:

```sh
cp .env.example .env.local
```

Edit `.env.local`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-local-publishable-key
```

Replace `your-local-publishable-key` with your own local project's key. Never use
its secret/service-role key in the app. `.env.local` is ignored by Git; do not
replace an already-configured file each time you pull.

Each developer has a separate local database and storage. Teammates' accounts,
posts, and photos will not appear automatically. A shared hosted project is a
separate setup described in [architecture](architecture.md#hosted-development).

## Browser on your computer

From `apps/mobile`:

```sh
npm run web -- --clear
```

Open the address printed by Expo, normally http://localhost:8081. Leave the
terminal running. If the port is occupied, use the new port shown by Expo.

If `.env.local` currently has a phone-network URL, macOS/Linux users can override
it for one run without changing the file:

```sh
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 npm run web -- --clear
```

On PowerShell, set `$env:EXPO_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"` before
running `npm run web -- --clear`. Remove that shell override with
`Remove-Item Env:EXPO_PUBLIC_SUPABASE_URL` before switching back to a phone URL.

### Phone-sized browser view

In Chrome on macOS:

1. Open the running app.
2. Choose **View → Developer → Developer Tools** (Command–Option–I).
3. Click the phone/tablet icon near the top-left of DevTools
   (Command–Shift–M).
4. In **Dimensions: Responsive**, select a phone, then refresh the page.

On Windows/Linux, DevTools and device mode use Ctrl–Shift–I and Ctrl–Shift–M.
This is the web app at phone dimensions; it does not test native camera access,
permissions, or native navigation. Choose a file from your computer to test uploads.

## Sign in locally

1. Enter a test address such as `alice@vanderbilt.edu` and request a code.
2. On your computer, open http://localhost:54324.
3. Copy the code from that address's message into Munchie.
4. Choose a display name when prompted.

Codes are generated for each request; there is no fixed demo password or code.
Local emails are captured, not delivered to a real Vanderbilt inbox. Use another
address, such as `bob@vanderbilt.edu`, for the second-user test. A private browser
window lets you keep two sessions open. Expo account login and Munchie email login
are separate systems.

## Physical iPhone or Android phone

### 1. Find the computer's network address

Connect the phone and computer to the same Wi-Fi. On macOS, open
**System Settings → Wi-Fi → Details → TCP/IP** and find the IP address. On many
Macs, `ipconfig getifaddr en0` also prints it. On Windows, use `ipconfig` and find
the active Wi-Fi adapter's IPv4 address.

Set `EXPO_PUBLIC_SUPABASE_URL` in `.env.local` to `http://<computer-IP>:54321`,
replacing `<computer-IP>` with the actual address. For example, if the computer
shows `192.168.1.25`, use `http://192.168.1.25:54321`. Do not paste the placeholder
literally. The address may change when reconnecting or switching networks.

`127.0.0.1` on a phone refers to the phone, not your computer.

### 2. Check backend reachability first

In Safari/Chrome **on the phone**, open:

```text
http://<computer-IP>:54321/auth/v1/health
```

Replace the placeholder as above. A response containing `GoTrue` confirms the
phone can reach authentication. If it cannot connect, check Wi-Fi, VPN routing,
and the computer's firewall. School/guest networks may block device-to-device
traffic; use a network that permits it. A working Expo tunnel does not expose
Supabase's separate port automatically.

### 3. Sign into Expo when required

For physical iPhone Expo Go, sign into the same Expo account on the phone and CLI.
From `apps/mobile`, Google-linked accounts can use browser login:

```sh
npx expo login --browser
npx expo whoami
```

Choose Google in the browser and confirm `whoami` matches the Expo Go account.
For username/password accounts, `npx expo login` is also available. Enter
credentials in the login prompt, not in source files or shared terminal logs.
These options are available in this project's CLI (`npx expo login --help`).
See [Expo's device startup guide](https://docs.expo.dev/get-started/start-developing/).

### 4. Start the phone server

Stop any existing Expo process in that terminal with Ctrl+C. From `apps/mobile`:

```sh
npx expo start --go --lan --clear
```

Use LAN, not `--localhost`, for a physical phone. Allow Local Network access in
Expo Go if iOS asks. On iPhone, scan the terminal QR with Apple's Camera app; on
Android, use Expo Go's scanner. Alternatively, on iPhone open the exact
`exp://...` address printed by Expo in Safari and accept **Open in Expo Go**.

To keep a browser demo on 8081 and a phone server on 8082, macOS/Linux users can
start another terminal in `apps/mobile` and run (replace the example IP):

```sh
EXPO_PUBLIC_SUPABASE_URL=http://192.168.1.25:54321 npx expo start --go --lan --port 8082
```

Each process keeps its own environment. Use the QR/address from the phone server,
including its port. This override allows `.env.local` to stay configured for the
browser. With a separate phone process, browser testing can continue unchanged.

The project uses Expo SDK 57. If Expo Go reports an incompatible SDK or a missing
native module, verify the installed app supports this project; use a compatible
Expo Go or a development build. Do not change SDK versions just to silence an
error. See [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/).
Native end-to-end testing is still pending; follow the [phone checklist](testing.md#manual-acceptance).

## Simulators and emulators

| Target | Supabase URL |
| --- | --- |
| Browser on backend computer | `http://127.0.0.1:54321` |
| iOS Simulator on the Mac | `http://127.0.0.1:54321` |
| Standard Android Studio emulator | `http://10.0.2.2:54321` |
| Physical phone | Computer's Wi-Fi IP with port `54321` |

With the relevant simulator tools installed, run `npm start` from `apps/mobile`
and press `i` or `a`. Restart Expo when switching environment settings. Use a real
phone for the camera acceptance test.

## Services, updates, and shutdown

| Service | Address on your computer |
| --- | --- |
| Expo web app | Printed by Expo; normally http://localhost:8081 |
| Supabase API | http://127.0.0.1:54321 |
| Supabase Studio | http://127.0.0.1:54323 |
| Captured email | http://127.0.0.1:54324 |

Studio's Table Editor shows profiles, dining halls, and posts; Authentication
shows users; Storage contains `food-photos`.

After pulling dependency changes, run `npm ci` in `apps/mobile`. For new migrations
on an existing local database, run `npx --yes supabase migration up --local` from
the root. Restart Expo after changes to environment variables, entry points,
plugins, or import aliases.

After editing Supabase auth configuration or email templates, run from the root:

```sh
npx --yes supabase stop
npx --yes supabase start
```

Stopping preserves local data by default. `npx --yes supabase db reset --local`
rebuilds from migrations but **deletes the local database's existing app data**;
use it only for a disposable test setup. Normal startup does not require a reset.
Stop Expo with Ctrl+C when finished.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `cd: no such file or directory: apps/mobile` | You may already be there. Run `pwd`; navigate from the repository root only once. |
| `Failed to fetch` during sign-in | Confirm the backend is running and the URL fits the device. Never leave `YOUR_MAC_IP` literally in the URL. Test the health endpoint, then restart Expo. |
| iPhone says CLI is not signed in | Use `npx expo login --browser`, then `npx expo whoami`; match the account in Expo Go and retry. Restart Expo if the old error persists. |
| QR says “No usable data found” | Start with `--go`; scan the latest terminal QR with the correct scanner or open its exact `exp://` URL. |
| Phone cannot reach Expo | Use `--lan`; check Local Network permission, Wi-Fi isolation, and firewall. A browser-only `--localhost` server cannot serve the phone. |
| Can't resolve `@/lib/auth` after a branch change | Stop Expo and restart with `--clear` so it loads the current `tsconfig.json` aliases and entry point. |
| `<<<<<<< HEAD` syntax error | A merge is unfinished. Resolve it and check `git status` before restarting; cache clearing cannot fix conflict markers. |
| Unexpected text node inside a View | Check JSX for bare strings or `{someString && ...}`; use a boolean condition or a ternary returning `null`. The Feed occurrence was fixed. |
| Invalid or expired email code | Request a new code and use the latest message addressed to that account. Check email templates if only a link appears. |
