# AnimeWorld India PHP + cURL API

Deploy this directory to any PHP 8.1+ hosting service with `curl` and `dom` (`libxml`) extensions enabled (e.g., Hostinger, Render PHP Docker, Railway PHP, or InfinityFree).

## Endpoints

- `home.php` — Latest Series and Movies
- `series.php?p=1` — Complete Series List (paginated)
- `movie.php?p=1` — Complete Movie List (paginated)
- `search.php?query=naruto&p=1` — Search Series & Movies (paginated)
- `a2z.php?letter=A&p=1` — Alphabetical Browsing (`0-9`, `A`–`Z`, paginated)
- `seasons.php?seriesID=naruto-shippuden` — Series Metadata & Seasons
- `episodes.php?seasonId=...` — Season Episodes
- `stream.php?episodeId=...` or `stream.php?movieId=...&lang=hindi` — Episode & Movie Stream Links

## Connecting to Flix4U

Set `ANIMEWORLD_INDIA_API_URL` in your Flix4U server environment (e.g. Vercel / Cloud Run):

```
ANIMEWORLD_INDIA_API_URL="https://your-php-host.example.com/animeworld-india-api"
```

When `ANIMEWORLD_INDIA_API_URL` is configured, Flix4U routes `/api/anime-world-india/v1/*` directly through this hosted PHP API. When omitted, Flix4U's Node.js backend handles these endpoints natively.
