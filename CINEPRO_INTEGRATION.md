# CinePro integration

Flix4U is personal, non-commercial, and guest-only. This integration is optional and uses only CinePro Core's public OMSS HTTP API. No provider scraper/decryption code was copied, and no auth, paywall, DRM, captcha, or geo restriction handling is included.

## What was added

- Flutter can call a self-hosted CinePro Core instance directly for items with a TMDB ID.
- The Node backend tries CinePro first for `tmdb:movie:<id>` / `tmdb:tv:<id>` ids, then falls back to the existing Archive.org and public anime sources.
- OMSS responses are normalized into Flix4U's existing `StreamSource` / `StreamOption` model, so the player and resource picker are unchanged.
- CinePro proxy URLs are converted to absolute URLs using the configured base URL.
- CinePro is completely optional. If unset or unreachable, the app behaves exactly as before.

## Public endpoints used

```text
GET /v1/movies/{tmdbId}
GET /v1/tv/{tmdbId}/seasons/{s}/episodes/{e}
GET /v1/proxy?data=...
```

## Enable it later

The current APK does not need any setup. To enable CinePro sources:

1. Get a free TMDB API key for personal use.
2. Start CinePro Core on a machine reachable by the phone:

```bash
docker run --name cinepro-core -p 3000:3000 \
  -e TMDB_API_KEY=YOUR_TMDB_KEY \
  ghcr.io/cinepro-org/core:latest
```

3. Set one of these:
   - GitHub repository variable/secret `CINEPRO_BASE_URL`, for example `https://my-home-server.example.com`, then rebuild the APK in CI.
   - Or set `CINEPRO_BASE_URL` in the Node backend environment to use the backend adapter.

Optional backend variables:

```env
CINEPRO_BASE_URL=https://my-home-server.example.com
CINEPRO_ENABLED=true
CINEPRO_TIMEOUT_MS=15000
```

## Behavior

- Movie: `/v1/movies/{id}`
- TV: `/v1/tv/{id}/seasons/1/episodes/{episode}`
- If CinePro returns no playable sources, Flix4U continues with existing public sources.
- Failed CinePro calls are logged server-side and never shown as app errors.
- Source labels show the provider name and quality, e.g. `Vidsrc · 1080p`.

## License note

CinePro Core is PolyForm Noncommercial 1.0. It fits personal/self-use only. Commercial hosting or redistribution is outside the intended license.
