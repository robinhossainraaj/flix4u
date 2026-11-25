# MovieBox-inspired UI spec for Flix4U

Source: 8 real screenshots in `/sdcard/GenAi/reference/`, OCR + color sampling.
Only structure, colors, spacing, and control names are used — no MovieBox code, branding, or assets.

## Reference palette override

The MovieBox screenshots use a mint green accent, but the user supplied a
separate palette image:

```txt
/sdcard/GenAi/reference/colour palette for app.jpeg
```

Palette sampled from that image:

```txt
#061418  deepest shade
#11212D  elevated surface
#253745  mid surface / borders
#4A5C6A  secondary slate
#9AA8AB  muted text
#CCD0CF  primary text / CTA
#0E1C27  app background
```

Flix4U uses the supplied palette instead of the MovieBox green.

## Extracted visual system

- Screen capture size: `1220 x 2712`
- App background: `#0E1C27`
- Elevated surfaces: `#11212D`, `#253745`
- Primary CTA: light grey `#CCD0CF`
- Primary text: `#CCD0CF`
- Secondary text: `#9AA8AB`
- Bottom navigation background: `#253745`
- Card image style: **landscape 16:9 thumbnails**, not portrait posters
- Card title sits below the image, 1–2 lines
- Badges: rating (e.g. `6.4`), year, language (`Hindi`), type (`Movie`, `Series`, `Anime`)

## Bottom navigation

MovieBox uses 4 tabs:

```txt
Home | ShortTV | Downloads | Me
```

Flix4U adaptation:

```txt
Home | Search | Downloads | Me
```

`Me` will contain Watch History, My List, Settings, and About — matching the reference profile screen.

## Home structure

Implemented layout:

- Header row:
  - left: Flix4U logo mark + wordmark
  - right: search box with search icon + profile/notification icon
- Horizontal category tab strip with active underline:
  ```txt
  Trending | Movies | TV Series | Anime | Free
  ```
- Auto-sliding banner carousel:
  - backdrop image
  - title
  - release year
  - genres / types
  - rating badge
  - prominent `Watch now` button
- Continue Watching rail from local Hive storage
- Lazy-loaded horizontal rails with landscape cards
- Section header pattern: title on left, `All >` on right
- Tapping a banner, rail card, search result, or category card resolves the
  stream and opens the player directly.

MovieBox reference labels seen in OCR:

- `Trending`
- `K-Drama`
- `All >`
- `The Substitute`
- `Love in Disguise`
- `The Remarried ...`

## Category / filter screen

- Top search icon
- Second tab row:
  ```txt
  Movie | TV/Series | Anime | Music | Game | Hindi | Arab | ...
  ```
- Grid/list of landscape cards
- Each card shows:
  - thumbnail
  - rating badge
  - title
  - year / country / genre line
  - language chip

## Detail screen

The detail screen is no longer the default destination when a title is tapped.
Content taps go straight to playback. A detail route remains for deep links.

Reference structure to keep available for a later optional detail sheet:

- Large media hero at the top
- Info row: rating, year, country, genre
- Action row:
  ```txt
  Add to list | Share | Download | View Resources
  ```
- Language chips
- Comments / For you tabs appear below in the player page

## Player page

- Video player occupies the top landscape area
- Top overlay icons: back, TV/cast, help
- Time display format: `00:04/2:56:49`
- Below video:
  - title + info row
  - Add to list / Share / Download / View Resources
  - tabs: `For you` | `Comments(27)`
- Fullscreen control should be available on the video itself

## Back navigation rules

- Home is the root tab:
  - first back press shows `Press back again to exit Flix4U`
  - second press within 2 seconds exits the app
- Search, Downloads, and Me are tab roots:
  - back returns to Home
- Pushed screens show an explicit back button:
  - category, detail, player, library, settings
- Pushed Downloads from Me pops back to Me
- No back button is shown on tab roots where it has no previous screen

## Step-by-step implementation plan

### Step 1 — Design system + shell — DONE
- User-supplied navy/grey palette
- Landscape card as default card
- 4-tab bottom nav: Home / Search / Downloads / Me
- Me page with Watch History, My List, Settings, About
- Android back handling and explicit back buttons
- Direct stream playback from content taps

### Step 2 — Home UI — DONE
- Logo/search header
- Underline category strip
- Auto-sliding banner with title, year, genres, rating and Watch now
- Landscape rails with `All >`
- Continue Watching rail from local storage

### Step 3 — Category + Search
- Category hero + chips + filter sheet
- Landscape result grid
- Search suggestions and recent searches

### Step 4 — Detail / optional info sheet
- Keep a lightweight info sheet available without blocking direct play
- Episode selection for TV/anime

### Step 5 — Custom player
- Video on top, detail/comments below
- Gesture seek, brightness, volume
- Speed / quality / subtitle sheet
- Next episode, resume, PiP, fullscreen

### Step 6 — QA
- Rebuild APK after each major step
- User tests on device
- Fix issues before next step
