const String kBackendBaseUrl = String.fromEnvironment(
  'FLIX4U_BACKEND_URL',
  defaultValue: 'https://your-flix4u-backend.vercel.app',
);

class Endpoints {
  static const String health = '/api/health';
  static const String home = '/api/catalog/home';
  static const String trending = '/api/catalog/trending';
  static const String search = '/api/catalog/search';
  static const String detail = '/api/catalog/detail';
  static const String resolveStream = '/api/stream/resolve';

  // Inherited anime routes from the KuroStream backend.
  static const String animeInfo = '/api/anime/info';
  static const String animeServers = '/api/anime/servers';
  static const String animeWatch = '/api/anime/watch';
  static const String anilist = '/api/anilist';
}
