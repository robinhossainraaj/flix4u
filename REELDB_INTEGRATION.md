# ReelDB + public source integration

Flix4U is personal, non-commercial and guest-only. This integration uses ReelDB only for metadata and keeps the API key on the Node backend.

## Security

- The ReelDB key is stored in the backend environment as `REELDB_API_KEY`.
- It is never written to Dart code, `dart-define`, GitHub, or the APK.
- The credential supplied in chat returned `Invalid API key` when tested. Generate a fresh key at ReelDB and use the new one in the backend environment.
- Error messages are redacted before being sent to the app.

## Backend setup

Set these environment variables on the deployed Node backend:

```env
REELDB_API_KEY=your_new_key
REELDB_BASE_URL=https://api.reeldb.io
REELDB_TIMEOUT_MS=8000
```

New routes:

```text
GET /api/reeldb/search?q=matrix&type=movie&page=1
GET /api/reeldb/title?tmdb=603&append=ratings,cast,providers,seasons
GET /api/reeldb/title?imdb=tt0133093
GET /api/reeldb/ratings?tmdb=603
GET /api/reeldb/cast?tmdb=603
GET /api/reeldb/providers?tmdb=603
GET /api/reeldb/seasons?tmdb=603
GET /api/reeldb/seasons/1?tmdb=603
```

Caching is in-memory only:

- search: 15 minutes
- title: 6 hours
- cast/ratings/providers/seasons: 24 hours

The backend converts ReelDB responses into Flix4U's existing `MediaItem` shape, including optional `imdbId`, ratings, cast, providers and seasons.

## Flutter behavior

- If no real `FLIX4U_BACKEND_URL` was provided at build time, the app skips backend calls entirely and goes straight to public APIs. No 6-second dead-end timeout.
- Search tries: backend catalog → ReelDB proxy → public Archive.org / AniList.
- Detail tries: backend catalog → ReelDB proxy → public Archive.org / AniList.
- Home keeps its existing shimmer skeletons and public fallback rows.
- The Resources picker shows native direct HLS/MP4 options.
- The Sources button opens public embed pages in the device browser. No scraping, ad bypass, paywall, DRM, captcha or geo handling is included.

## Public APIs verified during development

```text
Archive.org advancedsearch: HTTP 200
Archive.org metadata + MP4 download: HTTP 200, video/mp4
AniList GraphQL trending: HTTP 200
placeholder backend URL: HTTP 404 (treated as unconfigured)
```

## Activation

The current APK works with public APIs without any server. To activate ReelDB:

1. Deploy `flix4u-backend` with `REELDB_API_KEY`.
2. Set the GitHub repository variable `FLIX4U_BACKEND_URL` to that deployed URL.
3. Rebuild the APK in CI.

If ReelDB is unavailable or rate-limited, Flix4U continues with the public fallbacks.
