# Flix4U Flutter app

Guest-only streaming app. No login, no Firebase.

- App name: **Flix4U**
- Android package: **com.flix4u.rorax**
- Backend: `../flix4u-backend`

## Current status

Implemented:

- Flutter source tree
- GoRouter navigation
- Home / Search / Detail / Player / Downloads / Settings screens
- Dio API client
- Media + stream JSON models
- Local Hive initialization
- HLS/MP4 player via `video_player` + `chewie`
- Graceful sample-data fallback when the backend catalog is not ready

Not yet implemented in Dart:

- Offline download manager screens (placeholder only)
- Favorites/watchlist local persistence UI
- Genre/year filter chips

## Build APK

Flutter SDK is required. From this folder:

```bash
chmod +x bootstrap_android.sh
./bootstrap_android.sh
```

Or manually:

```bash
flutter create --org com.flix4u --project-name flix4u --platforms=android .
flutter pub get
flutter build apk --release
```

Output:

```txt
build/app/outputs/flutter-apk/app-release.apk
```

## Backend URL

The app reads the backend URL at compile time:

```bash
flutter build apk --release \
  --dart-define=FLIX4U_BACKEND_URL=https://your-flix4u-backend.vercel.app
```

Default in source:

```txt
https://your-flix4u-backend.vercel.app
```

## Legal note

Use only sources you are allowed to scrape and stream. Do not bypass logins, paywalls, DRM, captchas, or geo-blocks.
