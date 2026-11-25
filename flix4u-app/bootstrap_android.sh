#!/usr/bin/env bash
set -e

# Run this once on a machine that has Flutter installed.
# It generates the android/ platform folder without overwriting the Dart source.
flutter create --org com.flix4u --project-name flix4u --platforms=android .
chmod +x configure_android.sh
./configure_android.sh

flutter pub get
flutter build apk --release \
  --dart-define=FLIX4U_BACKEND_URL="${FLIX4U_BACKEND_URL:-https://your-flix4u-backend.vercel.app}" \
  --dart-define=CINEPRO_BASE_URL="${CINEPRO_BASE_URL:-}"

echo "APK: build/app/outputs/flutter-apk/app-release.apk"
