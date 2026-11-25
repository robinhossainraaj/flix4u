#!/usr/bin/env node
/**
 * Builds the public Flix4U JSON catalog from keyless APIs.
 *
 * No credentials are used. The generated file is committed to docs/api so
 * GitHub Pages can serve it as a tiny public backend for the Flutter app.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ARCHIVE = 'https://archive.org';
const ANILIST = 'https://graphql.anilist.co';
const OUTPUT = path.resolve('docs/api/catalog.json');

const COLLECTIONS = [
  { key: 'movies', collection: 'feature_films', rows: 30, type: 'movie' },
  { key: 'classic', collection: 'silent_films', rows: 20, type: 'movie' },
  { key: 'series', collection: 'classic_tv', rows: 26, type: 'tv' },
  { key: 'shorts', collection: 'short_films', rows: 22, type: 'short' },
  { key: 'music', collection: 'etree', rows: 18, type: 'music' },
];

const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Flix4U-Static-Catalog/1.0 (+https://github.com/robinhossainraaj/flix4u)',
};

const ANILIST_QUERY = `
query ($page: Int, $perPage: Int, $sort: [MediaSort]) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, sort: $sort) {
      id
      title { romaji english native }
      coverImage { extraLarge large }
      bannerImage
      description
      genres
      seasonYear
      averageScore
      countryOfOrigin
    }
  }
}
`;

async function fetchJson(url, init = {}, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        headers: { ...HEADERS, ...(init.headers || {}) },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function text(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function integer(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function double(value) {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function languageFrom(value) {
  const lower = text(value).toLowerCase();
  const languages = [
    'Hindi', 'English', 'Tamil', 'Telugu', 'Bengali', 'Arabic', 'French',
    'Spanish', 'Japanese', 'Korean', 'Chinese', 'Portuguese', 'Russian', 'Italian',
  ];
  return languages.find((language) => lower.includes(language.toLowerCase())) || 'Original';
}

function isFeaturedSafe(title, description) {
  const haystack = `${title} ${description}`.toLowerCase();
  const blocked = [
    'sex', 'nude', 'naked', 'porn', 'xxx', 'adult film', 'adult movie',
    'lesbianism', 'sex out of wedlock', 'casting couch',
  ];
  return !blocked.some((word) => haystack.includes(word));
}

function qualityFor(name, size) {
  const lower = text(name).toLowerCase();
  if (lower.includes('2160') || lower.includes('4k')) return '2160p 4K · MP4';
  if (lower.includes('1080')) return '1080p HD · MP4';
  if (lower.includes('720')) return '720p HD · MP4';
  if (lower.includes('480')) return '480p SD · MP4';
  const bytes = Number(size) || 0;
  if (bytes > 1_200_000_000) return 'HD · MP4';
  if (bytes > 300_000_000) return 'SD · MP4';
  return 'Auto · MP4';
}

function archiveSearchUrl(collection, rows) {
  const params = new URLSearchParams();
  params.set('q', `collection:${collection} AND format:"MPEG4"`);
  for (const field of [
    'identifier', 'title', 'description', 'subject', 'year', 'country', 'language',
  ]) {
    params.append('fl[]', field);
  }
  params.set('rows', String(rows));
  params.set('page', '1');
  params.set('output', 'json');
  params.append('sort[]', 'downloads desc');
  return `${ARCHIVE}/advancedsearch.php?${params.toString()}`;
}

async function searchArchive(collection, rows) {
  const json = await fetchJson(archiveSearchUrl(collection, rows));
  return json?.response?.docs || [];
}

async function mapWithConcurrency(values, limit, mapper) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker())
  );
  return results.filter(Boolean);
}

function playableFiles(files) {
  return (Array.isArray(files) ? files : [])
    .filter((file) => file && typeof file.name === 'string')
    .filter((file) => /\.(mp4|m4v|webm)$/i.test(file.name))
    .filter((file) => (Number(file.size) || 0) > 2_000_000)
    .filter((file) => !/preview|sample|trailer/i.test(file.name))
    .sort((left, right) => {
      const leftSize = Number(left.size) || 0;
      const rightSize = Number(right.size) || 0;
      const leftPreferred = left.name.toLowerCase() === `${left.name.toLowerCase()}` && leftSize < 1_500_000_000;
      const rightPreferred = rightSize < 1_500_000_000;
      if (leftPreferred !== rightPreferred) return leftPreferred ? -1 : 1;
      return rightSize - leftSize;
    });
}

async function archiveItem(doc, type, index) {
  const identifier = text(doc.identifier).trim();
  if (!identifier) return null;
  try {
    const metadataJson = await fetchJson(
      `${ARCHIVE}/metadata/${encodeURIComponent(identifier)}`
    );
    const metadata = metadataJson?.metadata || {};
    const files = playableFiles(metadataJson?.files);
    if (!files.length) return null;

    const streams = files.slice(0, 5).map((file) => ({
      url: `${ARCHIVE}/download/${encodeURIComponent(identifier)}/${encodeURIComponent(file.name)}`,
      quality: qualityFor(file.name, file.size),
      type: file.name.split('.').pop().toLowerCase(),
      language: 'Original',
    }));

    const title = stripHtml(doc.title || metadata.title) || identifier;
    const description = stripHtml(doc.description || metadata.description);
    if (!isFeaturedSafe(title, description)) return null;
    const subjects = Array.isArray(doc.subject)
      ? doc.subject
      : Array.isArray(metadata.subject)
      ? metadata.subject
      : [];
    const year = integer(doc.year || metadata.year);
    const country = text(doc.country || metadata.country);
    const language = languageFrom(`${text(doc.language)} ${text(metadata.language)} ${title} ${description}`);

    return {
      id: `archive:${type === 'movie' ? 'movie' : type === 'tv' ? 'tv' : type}:${identifier}`,
      type: type === 'tv' ? 'tv' : 'movie',
      title,
      poster: `${ARCHIVE}/services/img/${encodeURIComponent(identifier)}`,
      backdrop: `${ARCHIVE}/services/img/${encodeURIComponent(identifier)}`,
      description,
      provider: 'archive',
      genres: subjects.slice(0, 8).map((genre) => stripHtml(genre)).filter(Boolean),
      year,
      rating: double(doc.avg_rating || metadata.avg_rating),
      country: country || undefined,
      language: language || undefined,
      imdbId: undefined,
      extras: {
        identifier,
        collection: doc.collection || undefined,
        streamProvider: 'archive',
        streamReferer: `${ARCHIVE}/`,
        streams,
        rank: index + 1,
      },
    };
  } catch (error) {
    console.warn(`Skip ${identifier}: ${error.message}`);
    return null;
  }
}

function anilistItems(media) {
  return (Array.isArray(media) ? media : []).map((item) => {
    const titleMap = item?.title || {};
    const cover = item?.coverImage || {};
    const title = stripHtml(
      titleMap.english || titleMap.romaji || titleMap.native || 'Untitled'
    );
    const genres = Array.isArray(item?.genres) ? item.genres : [];
    const rating = typeof item?.averageScore === 'number'
      ? item.averageScore / 10
      : undefined;
    return {
      id: `anilist:${item.id}`,
      type: 'anime',
      title,
      poster: text(cover.extraLarge || cover.large),
      backdrop: text(item.bannerImage),
      description: stripHtml(item.description),
      provider: 'anilist',
      genres,
      year: integer(item.seasonYear),
      rating,
      country: text(item.countryOfOrigin) || undefined,
      language: 'Japanese',
      imdbId: undefined,
      extras: {
        anilistId: item.id,
        rank: 0,
      },
    };
  });
}

async function anilist(sort) {
  const json = await fetchJson(ANILIST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: ANILIST_QUERY,
      variables: { page: 1, perPage: 24, sort: [sort] },
    }),
  });
  if (json?.errors?.length) throw new Error(json.errors[0]?.message || 'AniList error');
  return anilistItems(json?.data?.Page?.media);
}

function byGenre(items, words) {
  const filtered = items.filter((item) =>
    item.genres.some((genre) =>
      words.some((word) => genre.toLowerCase().includes(word))
    )
  );
  return filtered.length >= 3 ? filtered : items;
}

async function main() {
  console.log('Generating public Flix4U GitHub catalog...');

  const archiveJobs = await Promise.all(
    COLLECTIONS.map(async (config) => {
      const docs = await searchArchive(config.collection, config.rows);
      console.log(`${config.collection}: ${docs.length} candidates`);
      const items = await mapWithConcurrency(docs, 8, (doc, index) =>
        archiveItem(doc, config.type, index)
      );
      console.log(`${config.collection}: ${items.length} playable items`);
      return [config.key, items];
    })
  );
  const sections = Object.fromEntries(archiveJobs);

  let anime = [];
  let popularAnime = [];
  try {
    anime = await anilist('TRENDING_DESC');
    popularAnime = await anilist('POPULARITY_DESC');
  } catch (error) {
    console.warn(`AniList unavailable: ${error.message}`);
  }

  const home = {
    trending: sections.movies,
    freeMovies: sections.movies,
    movies: sections.movies,
    classicMovies: sections.classic,
    adventure: byGenre(sections.movies, ['action', 'adventure', 'comedy', 'western']),
    webSeries: sections.series,
    classicSeries: sections.series,
    documentarySeries: sections.series,
    anime,
    popularAnime,
    shorts: sections.shorts,
    music: sections.music,
  };

  const seen = new Set();
  const items = [];
  for (const row of Object.values(home)) {
    for (const item of row || []) {
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
  }

  const catalog = {
    generatedAt: new Date().toISOString(),
    source: 'github-pages',
    note: 'Public keyless data from Archive.org and AniList. No credentials.',
    sources: {
      archive: ARCHIVE,
      anilist: ANILIST,
    },
    counts: Object.fromEntries(
      Object.entries(home).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0])
    ),
    home,
    items,
  };

  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(catalog)}\n`, 'utf8');
  console.log(`Wrote ${OUTPUT} (${items.length} items)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
