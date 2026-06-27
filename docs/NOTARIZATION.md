# Notarized release (v1 proper)

Lost Media Emulator ships from `npm run dist`. By default that produces an
**ad-hoc** build: it runs locally, but a downloaded copy trips Gatekeeper
("damaged / unidentified developer") and `electron-updater` can't self-apply.
For the real launch the build must be **Developer-ID-signed + notarized**.

The build config (`electron-builder.config.cjs`) already detects the credentials
and flips to the notarized path automatically — hardened runtime, the Developer
ID certificate, `build/entitlements.mac.plist`, and notarytool. There is **no
code to change**. The only thing missing is an Apple Developer account + cert.

## One-time setup

### 1. Enrol in the Apple Developer Program  ← current blocker
- https://developer.apple.com/programs/ → enrol ($99/yr).
- Verification can take from minutes to a couple of days.
- Afterwards you have a 10-character **Team ID** (Membership details page).

### 2. Create a "Developer ID Application" certificate
1. Keychain Access → **Certificate Assistant → Request a Certificate From a
   Certificate Authority**. Enter your email, leave "Saved to disk", continue —
   this makes a `CertificateSigningRequest.certSigningRequest` and a private key
   in your login keychain.
2. https://developer.apple.com/account/resources/certificates → **+** →
   **Developer ID Application** → upload the CSR → download the `.cer`.
3. Double-click the `.cer` to install it into the **login** keychain.
4. Confirm it's there:
   ```bash
   security find-identity -v -p codesigning | grep "Developer ID Application"
   ```
   (electron-builder auto-discovers it — no path needs configuring.)

### 3. App-specific password for notarytool
- https://appleid.apple.com → Sign-In and Security → **App-Specific Passwords**
  → generate one (format `abcd-efgh-ijkl-mnop`).

### 4. Drop the credentials in `.env.signing`
```bash
cp .env.signing.example .env.signing
# fill APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID
```
`.env.signing` is gitignored — never commit it.

## Every release from here on

```bash
npm run dist:signed        # loads .env.signing, asserts cert+creds, builds + notarizes
```
The wrapper refuses to run (rather than silently ad-hoc) if a credential or the
certificate is missing. On success it prints the verify + push commands.

Verify the result:
```bash
xcrun stapler validate "release/Lost Media Emulator-<ver>-arm64.dmg"
spctl -a -vvv -t install "release/Lost Media Emulator-<ver>-arm64.dmg"
#   → accepted, source=Notarized Developer ID
```

Ship to R2 (from `~/Projects/lost-media-emulator-site`, see the `lme-r2-release`
skill). Because the build is now signed, the auto-update feed + version bump are
finally meaningful (they were no-ops for unsigned builds):
```bash
./.claude/skills/lme-r2-release/push.sh dmg    "$HOME/Projects/build-together-desktop/release/"*.dmg
./.claude/skills/lme-r2-release/push.sh update "$HOME/Projects/build-together-desktop/release"
# bump mac.version in versions.json, then:
./.claude/skills/lme-r2-release/push.sh versions versions.json
```

## Notes
- **Bump `package.json` version** before a release users will auto-update into —
  Squirrel only applies a feed whose version is greater than the installed one.
- The `afterSign` hook ad-hoc signs the bundled `ffmpeg`/`ffprobe` only on the
  unsigned path; on the notarized path electron-builder signs them with the
  Developer ID cert and notarization staples the whole app.
