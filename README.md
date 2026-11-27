# Flix4U

Android HLS (M3U8) streaming app. The GitHub repo itself is the database: the app fetches `channels.json` from this repo (raw GitHub URL) and renders the streams in a grid or list view with a built-in Media3 HLS player.

## Features

- Grid view / list view toggle
- HLS player (Media3 / ExoPlayer) in a dialog overlay
- Streams loaded from `channels.json` in this repo — add streams by committing JSON, the app's Refresh button pulls the latest
- Dark theme, landscape-friendly player

## JSON format (`channels.json`)

```json
[
  {
    "id": "bigbuck",
    "title": "Big Buck Bunny",
    "description": "Classic open movie test stream",
    "url": "https://example.com/stream.m3u8",
    "category": "Movies",
    "logo": "https://example.com/logo.png"
  }
]
```

A top-level `{"streams": [...]}` or `{"channels": [...]}` object also works.

## Build

GitHub Actions (`.github/workflows/build.yml`) builds debug + release APKs on every push to `main` and publishes them to a GitHub Release. APKs are also available as workflow artifacts.

## Stack

Kotlin, Jetpack Compose (Material 3), Media3 ExoPlayer + HLS, kotlinx.serialization, Coil.
