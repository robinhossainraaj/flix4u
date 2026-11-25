# Flix4U public GitHub backend

Flix4U now has a public, keyless catalog backend hosted directly from this GitHub repository.

## Endpoints

```text
https://robinhossainraaj.github.io/flix4u/api/catalog.json
https://raw.githubusercontent.com/robinhossainraaj/flix4u/main/docs/api/catalog.json
```

The raw URL is only a fallback while GitHub Pages publishes. The app tries Pages first.

## What serves the catalog

- GitHub Pages serves `docs/api/catalog.json`.
- `scripts/generate-github-catalog.mjs` builds it from public APIs:
  - Archive.org `advancedsearch` and `metadata`
  - AniList GraphQL
- `.github/workflows/update-github-catalog.yml` refreshes it daily.
- There are no API keys, accounts, secrets, Firebase, or per-user data.

## What the app does

- Home, Search, Category, Detail, ShortTV, and Recommendations read the public catalog.
- Archive.org items include ready-to-play direct MP4/HLS-style resources in `extras.streams`.
- Player uses those direct resources first, so playback does not need another resolver call.
- If the public catalog is unreachable, the app falls back to direct live Archive.org / AniList requests.
- If a real Node backend is configured later, it still takes priority over the GitHub catalog.

## Verified live

```text
Archive.org advancedsearch: HTTP 200, real titles
Archive.org poster image: HTTP 200, image/jpeg
Archive.org MP4 range request: HTTP 206, video/mp4
AniList GraphQL: HTTP 200
```

## Notes

- The catalog contains public-domain and openly shared Archive.org media plus AniList metadata.
- Anime entries provide metadata and external-source links; native streams depend on the selected resource.
- ReelDB and TMDB remain optional and inactive unless valid keys are configured in a deployed Node backend. Their rejected keys were never written to this repository or APK.
