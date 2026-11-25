const String kBackendBaseUrl = String.fromEnvironment(
  'FLIX4U_BACKEND_URL',
  defaultValue: 'https://your-flix4u-backend.vercel.app',
);

/// Optional self-hosted CinePro Core URL.
///
/// When set, TMDB-backed items can resolve streams directly from an OMSS
/// CinePro instance before the existing public fallbacks are used.
const String kCineproBaseUrl = String.fromEnvironment(
  'CINEPRO_BASE_URL',
  defaultValue: '',
);

/// True only when a real backend URL was provided at build time.
///
/// The placeholder URL is deliberately treated as "not configured" so the app
/// goes straight to its public APIs instead of waiting for a dead DNS lookup.
bool get isBackendConfigured {
  final url = kBackendBaseUrl.trim();
  if (url.isEmpty || url.contains('your-flix4u-backend')) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

class Endpoints {
  static const String health = '/api/health';
  static const String home = '/api/catalog/home';
  static const String trending = '/api/catalog/trending';
  static const String search = '/api/catalog/search';
  static const String detail = '/api/catalog/detail';
  static const String resolveStream = '/api/stream/resolve';

  // ReelDB metadata proxy. The API key stays on the Node backend.
  static const String reeldbSearch = '/api/reeldb/search';
  static const String reeldbTitle = '/api/reeldb/title';
  static const String reeldbRatings = '/api/reeldb/ratings';
  static const String reeldbCast = '/api/reeldb/cast';
  static const String reeldbProviders = '/api/reeldb/providers';
  static const String reeldbSeasons = '/api/reeldb/seasons';

  // Inherited anime routes from the KuroStream backend.
  static const String animeInfo = '/api/anime/info';
  static const String animeServers = '/api/anime/servers';
  static const String animeWatch = '/api/anime/watch';
  static const String anilist = '/api/anilist';
}
