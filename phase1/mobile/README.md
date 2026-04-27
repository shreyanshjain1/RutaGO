# RutaGO Mobile Packaging (Android + iOS)

This folder wraps the existing RutaGO web app with Capacitor for native delivery.

## Prerequisites

- Node.js 18+
- Android Studio (for Android APK/AAB)
- Xcode on macOS (for iOS IPA/TestFlight)
- A reachable backend API URL (local LAN or hosted URL)

## 1) Configure Backend API URL for Mobile

Edit [../backend/public/rutago.config.js](../backend/public/rutago.config.js) and set:

```js
window.RUTAGO_CONFIG = {
  apiBaseUrl: "https://your-backend-domain-or-lan-ip:3000"
};
```

For Android emulator, `http://10.0.2.2:3000` can be used during local testing.

## 2) Install Mobile Wrapper Dependencies

```powershell
Set-Location c:\Users\sugz1\Downloads\manila\phase1\mobile
npm install
```

## 3) Generate Native Projects

```powershell
npm run add:android
npm run add:ios
```

If platforms already exist, skip these commands.

## 4) Sync Web Assets into Native Projects

```powershell
npm run sync
```

Run this each time you update files in `phase1/backend/public`.

## 5) Open Native IDEs

```powershell
npm run open:android
npm run open:ios
```

Then build release binaries in each IDE:

- Android Studio: Build APK/AAB
- Xcode: `pod install` (if needed), then Archive for TestFlight/App Store

If iOS dependencies are not installed yet:

```bash
cd ios/App
pod install
```

## Notes

- This packaging layer ships the current web MVP as a hybrid app.
- Notifications/geolocation can be upgraded later to native Capacitor plugins.
- If you change app id or signing settings, do it in native project settings after `add`.