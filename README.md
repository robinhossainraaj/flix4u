# Flix4U

Guest-only Flutter streaming app for movies, web series, and anime.

- App name: **Flix4U**
- Android package: **com.flix4u.rorax**
- Flutter app: `flix4u-app/`
- Node backend: `flix4u-backend/`

## Build the APK

The GitHub Actions workflow automatically builds the release APK:

```txt
.github/workflows/build-flix4u-apk.yml
```

Run **Actions → Build Flix4U APK**, then download the `flix4u-release-apk` artifact.

## Local build

```bash
cd flix4u-app
chmod +x bootstrap_android.sh configure_android.sh
./bootstrap_android.sh
```

Output:

```txt
build/app/outputs/flutter-apk/app-release.apk
```

## Backend

The app works without a backend using Archive.org and AniList directly. For anime playback, deploy `flix4u-backend/` to Vercel and set:

```env
STREAM_PROXY_SECRET=<long-random-secret>
TMDB_API_KEY=<optional>
```

Then set the repository variable:

```txt
FLIX4U_BACKEND_URL=https://your-project.vercel.app
```

No login, no Firebase, no user accounts.
