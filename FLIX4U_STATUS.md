# Flix4U build status

## Names

- App: **Flix4U**
- Android package: **com.flix4u.rorax**
- Flutter project: `flix4u-app/`
- Backend: `flix4u-backend/`

## Current state: testable

Flix4U is now a single-mode, guest-only app:

- No login screen
- No Firebase account system
- No user/profile/XP/community features
- No auth token checks on content routes
- Anyone can browse and play

Guest mode is hardcoded in the backend:

```ts
const PUBLIC_GUEST_MODE = true;
```

## What is implemented

### MovieBox-inspired UI pass

- Animated branded **splash screen** before Home.
- Five-bottom-tab layout: **Home / Search / Library / Downloads / Settings**.
- Home now has a MovieBox-style **top category strip**:
  Trending / Movies / Web Series / Anime / Free.
- Auto-sliding **hero banner carousel** with Play and Details buttons.
- Multiple horizontal **content rails** with See all navigation.
- Dedicated category pages with:
  - hero banner
  - genre filter chips
  - in-category search
  - sort by popular / A-Z / newest / rating
  - responsive poster grid
- Redesigned poster cards with type badge, rating badge, and metadata line.
- Redesigned detail page with backdrop hero, episode chips, and saved-state buttons.
- Redesigned search with type chips and locally stored recent searches.
- Redesigned library, downloads, and settings pages.
- Diversified public catalog rails from Archive.org and AniList.

### Backend (`flix4u-backend/`)

- Guest-only fork of the KuroStream backend.
- Firebase auth bypassed on all content routes.
- `/api/anime/proxy` guest-accessible.
- `/api/anime/stream-session` issues guest cookies.
- `/api/health` reports `guestMode: true` and `app: "Flix4U"`.
- Original owner emails, dead APK URL, package name, and backend URL references removed.
- Firebase config replaced with a disabled placeholder.
- `.env.example` and `vercel.json` cleaned.
- New public catalog routes:

```txt
GET /api/catalog/home
GET /api/catalog/trending?type=movie|tv|anime
GET /api/catalog/search?q=&type=all|movie|tv|anime
GET /api/catalog/detail/:type/:id
GET /api/stream/resolve?type=movie|tv|anime&id=...&title=...
```

- Movies/web series use TMDB metadata when `TMDB_API_KEY` is set.
- Without a TMDB key, movies/web series use Archive.org public metadata.
- Anime metadata uses AniList.
- Movie/TV stream resolution uses Archive.org public MP4 files.
- Anime stream resolution uses the inherited Megavid/AniZip resolver.
- `node --check server.ts` passes.
- Local smoke test passed:
  - `/api/health` → `guestMode: true`
  - `/api/catalog/home` → 12 items per section
  - `/api/catalog/search?q=doctor&type=movie` → results
  - `/api/stream/resolve?...id=archive:movie:AboutBan1935` → playable MP4 URL

### Flutter app (`flix4u-app/`)

- Dart source parses cleanly with Dart 3.14.
- GoRouter navigation.
- Home / Search / Detail / Player / Downloads / Settings screens.
- Dio API client with short timeout and **public direct fallback**.
- Direct fallback reads:
  - Archive.org for free movies/series catalog + playable MP4 stream
  - AniList GraphQL for anime catalog metadata
- Models and repositories for catalog + streams.
- HLS/MP4 player via `video_player` + `chewie`, correctly initialized.
- Episode number input for anime/TV.
- Local Hive storage for favorites, watchlist, and continue watching.
- Custom Flix4U launcher icons generated.
- Android package configured to `com.flix4u.rorax`.
- GitHub Actions workflow builds the release APK.

## How to get a test APK

This environment is ARM64 Linux. Flutter publishes only x64 Linux SDKs, so the APK cannot be compiled here.

Use GitHub Actions:

1. Push this workspace to a GitHub repository.
2. Go to **Actions → Build Flix4U APK → Run workflow**.
3. Download the `flix4u-release-apk` artifact.
4. Install it on your Android device.

Optional repository variable/secret:

```txt
FLIX4U_BACKEND_URL=https://your-deployed-flix4u-backend.vercel.app
```

If you do not set it, the app still works using Archive.org + AniList directly.

## Local build on a Flutter machine

```bash
cd flix4u-app
chmod +x bootstrap_android.sh configure_android.sh
./bootstrap_android.sh
```

Output:

```txt
build/app/outputs/flutter-apk/app-release.apk
```

With your own backend:

```bash
FLIX4U_BACKEND_URL=https://your-project.vercel.app ./bootstrap_android.sh
```

## What works without deploying the backend

- Home rows for free movies, classic series, and anime metadata
- Search across movies, series, and anime
- Detail pages
- Playback for Archive.org movie/series items
- Favorites / watchlist / continue watching

## What still needs the backend

- Anime playback, because it depends on the inherited resolver and AniZip mapping
- Any private/custom stream adapter you add later

## Latest test APK

```txt
/sdcard/GenAi/Flix4U-release.apk
```

SHA-256:

```txt
3dd64b4853dbccb77f72fc74c274c88233dca5bca00c1557616e24b54a872d88
```

Build run:

```txt
https://github.com/robinhossainraaj/flix4u/actions/runs/45619327950
```

## Legal note

Use only sources you are allowed to scrape and stream. Do not bypass logins, paywalls, DRM, captchas, or geo-blocks.
