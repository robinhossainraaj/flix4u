# Flix4U backend

Guest-mode fork of the KuroStream backend. No Firebase credentials are required.

## What was changed

- Guest mode is permanent: `PUBLIC_GUEST_MODE = true` in code. There is no login mode.
- `/api/anime/proxy` allows guest playback.
- `/api/anime/stream-session` issues a guest cookie signed with `STREAM_PROXY_SECRET`.
- `/api/health` reports `guestMode: true` and `app: "Flix4U"`.
- Removed original owner emails, APK URL, package name, and backend URL references.
- Replaced Firebase config with a disabled placeholder.
- Removed `google-services.json` from Vercel `includeFiles`.
- Cleaned `.env.example` for guest mode + TMDB + scraper tuning.

## Local run

```bash
npm install
npm run dev
```

## Deploy

1. Push this folder to your own GitHub repo.
2. Import into Vercel.
3. Set environment variables from `.env.example`.
4. Important:

```env
STREAM_PROXY_SECRET=<long-random-secret>
TMDB_API_KEY=<your-key>
```

5. Deploy.
6. Check:

```txt
GET https://your-project.vercel.app/api/health
```

Expected:

```json
{
  "success": true,
  "app": "Flix4U",
  "guestMode": true
}
```

## Catalog routes implemented

These routes are now public and used by the Flutter app:

```txt
GET /api/catalog/home
GET /api/catalog/trending?type=movie|tv|anime
GET /api/catalog/search?q=&type=&page=
GET /api/catalog/detail/:type/:id
GET /api/stream/resolve?type=anime&id=anilist:123&episode=1
```

- Movies and web series metadata come from TMDB.
- Anime metadata comes from AniList.
- Anime stream resolution uses the inherited Megavid fallback.
- Movie/TV stream adapters still need your own public sources. Until then `/api/stream/resolve` returns `STREAM_SOURCE_NOT_CONFIGURED` for those types.

## Safety

Keep the SSRF checks in `/api/anime/proxy`. Add rate limiting before public release. Only scrape sources you are permitted to use.
