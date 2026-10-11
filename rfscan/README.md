# Unique AV RF Scan

Desktop RF scanner for the **tinySA Ultra**, for Mac (.dmg) and Windows (.exe), with automatic updates.
Exports scans for Shure Wireless Workbench, Sennheiser WSM, and generic CSV for IAS, Wavetool, Soundbase, RF Venue and other coordination software.

## Project layout

| Path | What it is |
|---|---|
| `app/index.html` | The scanner UI and logic (also runs on its own in Chrome/Edge) |
| `main.js` | Electron main process: window, USB serial port picker, save dialogs, auto-updates, menus |
| `preload.js` | Safe bridge for version info and update messages |
| `build/` | App icon and macOS entitlements |
| `.github/workflows/release.yml` | Builds and publishes the .dmg and .exe on GitHub |

## One-time setup

1. Create a GitHub repository called `uniqueav-rf-scan`. It can be private, but see the note on private repos under Auto-updates below.
2. In `package.json`, change `"owner": "YOUR_GITHUB_USERNAME"` to your GitHub username.
3. Push this folder to the repository.

## Releasing a version (builds the .dmg and .exe)

```bash
# bump "version" in package.json, e.g. 1.0.1, then:
git commit -am "v1.0.1"
git tag v1.0.1
git push && git push --tags
```

GitHub Actions builds the Mac and Windows installers (about 10 minutes). It then publishes them to **Releases**:

- `UniqueAV-RF-Scan-1.0.1.dmg` – Mac universal build (Apple Silicon + Intel)
- `UniqueAV-RF-Scan-Setup-1.0.1.exe` – Windows installer
- `latest.yml`, `latest-mac.yml`, `.zip` and `.blockmap` files – used by auto-update; leave them in the release

## Auto-updates

- The installed app checks GitHub Releases 4 seconds after it starts, then every 4 hours.
- It downloads a new version quietly and shows **"Restart & update"** in the top bar. If you don't click it, the update installs the next time you quit.
- You can also check manually: **Unique AV RF Scan → Check for Updates…** on Mac, or **Help → Check for Updates…** on Windows.
- **Private repo:** update checks need a GitHub token to read private releases. A public repo is the simplest way to avoid that.

## Code signing (important on Mac)

- **Windows:** works unsigned. SmartScreen shows "Windows protected your PC" on first install; click **More info → Run anyway**. Auto-updates work.
- **Mac:**
  - **Unsigned builds:** these install and run. To open one the first time, right-click the app, choose **Open**, then click **Open**; on recent macOS you may need **System Settings → Privacy & Security → Open Anyway**. However, macOS will **not apply auto-updates to an unsigned app**. Without signing, download each new .dmg from Releases yourself.
  - **To get Mac auto-updates:** you need an Apple Developer account ($99/yr). Export your *Developer ID Application* certificate as a .p12 file, then add these repo secrets:
    - `MAC_CERT_P12_BASE64` – the .p12 file, base64-encoded (`base64 -i cert.p12 | pbcopy`)
    - `MAC_CERT_PASSWORD`
    - `APPLE_ID`
    - `APPLE_APP_SPECIFIC_PASSWORD`
    - `APPLE_TEAM_ID`

    The workflow then signs and notarises the app automatically.

## Building on your own machine

```bash
npm install
npm start          # run the app
npm run dist:mac   # on a Mac   → dist/*.dmg
npm run dist:win   # on Windows → dist/*.exe
```
