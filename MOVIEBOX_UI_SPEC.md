# MovieBox-inspired UI spec for Flix4U

Source: 8 real screenshots in `/sdcard/GenAi/reference/`, OCR + color sampling.
Only structure, colors, spacing, and control names are used — no MovieBox code, branding, or assets.

## Extracted visual system

- Screen capture size: `1220 x 2712`
- Background: `#101115`
- Elevated surfaces: `#1E1F23`, `#28292E`
- Primary accent / CTA: mint green `#77F395`
- Primary text: off-white `#F2EEEF`
- Secondary text: grey `#9CA3AF`
- Bottom navigation text: `#F2EEEF`
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

- Top status bar / header icons
- Horizontal top tab strip:
  ```txt
  Trending | Movie | TV | Channel | Midnight | Anime | ...
  ```
  Flix4U adaptation uses real data categories:
  ```txt
  Trending | Movie | TV | Anime | Free
  ```
- Large hero/banner area
- Lazy-loaded horizontal rails, typically 3 landscape cards visible per row
- Section header pattern: title on left, `All >` on right
- Examples from OCR:
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

- Large media hero at the top
- Info row: rating, year, country, genre
- Action row:
  ```txt
  Add to list | Share | Download | View Resources
  ```
- Uploader / source line
- Language chips
- Prominent green CTA button, e.g. `Check Now & Download`
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

## Step-by-step implementation plan

### Step 1 — Design system + shell
- Switch palette to `#101115` / `#1E1F23` / `#28292E` / `#77F395`
- Landscape card as default card
- 4-tab bottom nav: Home / Search / Downloads / Me
- Add Me page with Watch History, My List, Settings, About

### Step 2 — Home UI
- Header + MovieBox-style top tab strip
- Hero banner
- Landscape rails with `All >`
- Continue Watching rail from local storage

### Step 3 — Category + Search
- Category hero + chips + filter sheet
- Landscape result grid
- Search suggestions and recent searches

### Step 4 — Detail
- Landscape hero
- Info row + action row
- Episode chips
- Green CTA

### Step 5 — Custom player
- Video on top, detail/comments below
- Gesture seek, brightness, volume
- Speed / quality / subtitle sheet
- Next episode, resume, PiP, fullscreen

### Step 6 — QA
- Rebuild APK after each major step
- User tests on device
- Fix issues before next step
