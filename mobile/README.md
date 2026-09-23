# Yellow Android demo shell

This directory is an isolated Android delivery shell for Yellow's existing web
application. It does not contain PMS business logic, an offline database, API
credentials, or a production deployment. The visible banner and the `-demo`
version name intentionally identify that boundary.

## Requirements

- JDK 17
- Android SDK platform 35 and build-tools 35.x
- Gradle 8.9, or Android Studio with its bundled compatible Gradle runtime

The current host did not have Java, Gradle, the Android SDK, `adb`, or
`sdkmanager` when this project was created. Nothing was downloaded or installed.

## Configure and build

Only an absolute HTTPS URL is accepted. The URL is build-time configuration and
is not an API key or credential.

## Permanent mobile URL

Do not build APKs against random trycloudflare URLs. They are useful for a quick
browser check, but they expire or rotate and leave the installed app pointing at a
dead host.

For phone testing, use a stable HTTPS hostname. The zero-cost path is a named
Cloudflare Tunnel routed to a hostname you control, then build the APK with that
same stable address:

```powershell
.\scripts\mobile-stable-tunnel.ps1 `
  -PublicUrl 'https://yellow-mobile.your-domain.example/' `
  -LocalPort 3000 `
  -TunnelName yellow-mobile

cloudflared tunnel create yellow-mobile
cloudflared tunnel route dns yellow-mobile yellow-mobile.your-domain.example
cloudflared tunnel --config "$env:USERPROFILE\.cloudflared\yellow-mobile.yml" run yellow-mobile
```

After the stable URL opens the reviewed Yellow app from the phone browser, rebuild
the Android shell with that exact URL:

PowerShell with a locally installed Gradle:

```powershell
$env:YELLOW_PUBLIC_URL = 'https://yellow-mobile.your-domain.example/'
$env:YELLOW_ANDROID_BUILD_ROOT = 'G:\My Drive\Yellow\builds\yellow-android-work'
gradle --no-daemon clean assembleDebug
```

Or pass the value as a Gradle property:

```powershell
$env:YELLOW_ANDROID_BUILD_ROOT = 'G:\My Drive\Yellow\builds\yellow-android-work'
gradle --no-daemon clean assembleDebug -PYELLOW_PUBLIC_URL=https://yellow-mobile.your-domain.example/
```

Android Studio: open this `mobile` directory, set `YELLOW_PUBLIC_URL` in the
Gradle run configuration/environment, sync, then build the `app` module.

When `YELLOW_ANDROID_BUILD_ROOT` is set as above, the debug APK is written to
`G:\My Drive\Yellow\builds\yellow-android-work\app\outputs\apk\debug\app-debug.apk`.
On this laptop, keep APK, AAB and archive outputs under
`G:\My Drive\Yellow\builds\`; do not redirect them to C:. Without the optional
variable, Gradle uses its conventional local `app/build` directory on other
machines. A release build is intentionally unsigned; production signing material
must never be committed here.

## Security and microphone boundary

- HTTP and mixed content are rejected.
- File/content URL access and third-party cookies are disabled.
- In-WebView navigation and microphone capture are limited to the configured
  HTTPS origin (including its effective port).
- Android asks the user for microphone permission only when that approved origin
  requests audio capture; every other WebView resource request is denied.
- The default `https://demo.invalid/` value shows configuration instructions and
  does not attempt to connect to a Yellow server.

This shell does not make a laptop-local service reachable from a phone. The
configured server must already be safely reachable over HTTPS. Cloudflare or any
other tunnel remains external deployment infrastructure and is not embedded in
the APK. The APK stores only the approved HTTPS origin and continues to block
cleartext, localhost and off-origin microphone requests.
