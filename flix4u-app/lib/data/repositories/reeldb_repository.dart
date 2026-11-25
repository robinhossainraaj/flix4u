import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../models/media_item.dart';

/// Client for the ReelDB metadata routes on the Flix4U Node backend.
///
/// The ReelDB key is never present here: Flutter only talks to our backend.
/// Every method fails soft so the public Archive.org / AniList fallbacks keep
/// working when the backend or ReelDB is unavailable.
class ReelDbRepository {
  ReelDbRepository({ApiClient? api}) : _api = api ?? ApiClient();

  final ApiClient _api;

  Future<List<MediaItem>> search(String query, {String type = 'all'}) async {
    if (!isBackendConfigured) return const <MediaItem>[];
    final trimmed = query.trim();
    if (trimmed.length < 2) return const <MediaItem>[];
    try {
      final json = await _api.getJson(
        Endpoints.reeldbSearch,
        query: <String, dynamic>{
          'q': trimmed,
          if (type != 'all') 'type': _apiType(type),
        },
      );
      return _itemsFrom(_list(json));
    } catch (_) {
      return const <MediaItem>[];
    }
  }

  Future<MediaItem?> detail(
    String type,
    String id, {
    String? title,
  }) async {
    if (!isBackendConfigured) return null;
    final params = _lookupParams(type, id, title);
    if (params.isEmpty) return null;
    try {
      final json = await _api.getJson(
        Endpoints.reeldbTitle,
        query: <String, dynamic>{
          ...params,
          'type': _apiType(type),
          'append': 'ratings,cast,providers,seasons',
        },
      );
      if (json.isEmpty || json['error'] != null) return null;
      return _itemFrom(json, fallbackType: _normalizedType(type));
    } catch (_) {
      return null;
    }
  }

  Map<String, String> _lookupParams(String type, String id, String? title) {
    final raw = id.trim();
    final tmdbMatch = RegExp(r'^tmdb:(movie|tv):(\d+)$').firstMatch(raw);
    if (tmdbMatch != null) {
      return <String, String>{
        'tmdb': tmdbMatch.group(2)!,
        'type': tmdbMatch.group(1)!,
      };
    }
    final imdbMatch = RegExp(r'^imdb:(tt\d+)$').firstMatch(raw);
    if (imdbMatch != null) {
      return <String, String>{'imdb': imdbMatch.group(1)!};
    }
    if (RegExp(r'^\d+$').hasMatch(raw)) {
      return <String, String>{'tmdb': raw};
    }
    final name = (title ?? '').trim();
    if (name.isNotEmpty) return <String, String>{'t': name};
    if (raw.isNotEmpty && !raw.startsWith('archive:')) {
      return <String, String>{'t': raw};
    }
    return const <String, String>{};
  }

  List<dynamic> _list(Map<String, dynamic> json) {
    for (final key in <String>['items', 'results', 'titles', 'media']) {
      final value = json[key];
      if (value is List) return value;
    }
    return const <dynamic>[];
  }

  List<MediaItem> _itemsFrom(List<dynamic> raw) {
    return raw
        .whereType<Map>()
        .map((item) => _itemFrom(item.cast<String, dynamic>()))
        .where((item) => item.id.isNotEmpty)
        .toList();
  }

  MediaItem _itemFrom(
    Map<String, dynamic> json, {
    String fallbackType = 'movie',
  }) {
    final ids = json['ids'] is Map
        ? (json['ids'] as Map).cast<String, dynamic>()
        : <String, dynamic>{};
    final imdb = _text(ids['imdb'] ?? json['imdb'] ?? json['imdb_id']);
    final tmdb = _integer(ids['tmdb'] ?? json['tmdb'] ?? json['tmdb_id']);
    final type = _normalizedType(
      _text(json['type'], _text(ids['type'], fallbackType)),
    );
    final id = tmdb != null && tmdb > 0
        ? 'tmdb:$type:$tmdb'
        : imdb.isNotEmpty
        ? 'imdb:$imdb'
        : 'reeldb:${_text(ids['mdblist'] ?? json['id'] ?? json['slug'], json['title'].toString().hashCode.toString())}';

    final extras = <String, dynamic>{};
    for (final key in <String>[
      'ratings',
      'cast',
      'providers',
      'seasons',
      'runtime',
      'certification',
      'externalLinks',
      'links',
    ]) {
      if (json[key] != null) extras[key] = json[key];
    }
    if (imdb.isNotEmpty) extras['imdbId'] = imdb;
    if (tmdb != null) extras['tmdbId'] = tmdb;

    return MediaItem(
      id: id,
      type: type,
      title: _text(
        json['title'] ?? json['name'] ?? json['original_title'],
        'Untitled',
      ),
      poster: _image(json['poster'] ?? json['poster_path'] ?? json['image']),
      backdrop: _image(
        json['backdrop'] ?? json['backdrop_path'] ?? json['fanart'],
      ),
      description: _text(
        json['description'] ?? json['overview'] ?? json['plot'],
      ),
      provider: 'reeldb',
      genres: _strings(json['genres']),
      year: _integer(json['year'] ?? json['releaseYear']),
      rating: _rating(json['ratings'] ?? json['rating']),
      country: _textOrNull(json['country']),
      language: _textOrNull(json['language'] ?? json['original_language']),
      imdbId: imdb.isEmpty ? null : imdb,
      extras: extras,
    );
  }

  String _apiType(String type) {
    if (type == 'tv' || type == 'series') return 'series';
    if (type == 'anime') return 'series';
    return 'movie';
  }

  String _normalizedType(dynamic raw) {
    final value = _text(raw).toLowerCase();
    if (value == 'tv' || value == 'series' || value == 'show') return 'tv';
    if (value == 'anime') return 'anime';
    return 'movie';
  }

  String _image(dynamic raw) {
    if (raw == null) return '';
    if (raw is String) return raw;
    if (raw is Map) {
      final map = raw.cast<String, dynamic>();
      return _text(
        map['url'] ?? map['poster'] ?? map['path'] ?? map['image'],
      );
    }
    return '';
  }

  List<String> _strings(dynamic raw) {
    if (raw is List) {
      return raw
          .map(
            (value) => value is Map
                ? _text(value['name'] ?? value['title'])
                : _text(value),
          )
          .where((value) => value.isNotEmpty)
          .toList();
    }
    if (raw is String && raw.isNotEmpty) return <String>[raw];
    return const <String>[];
  }

  double? _rating(dynamic raw) {
    if (raw is num) return raw.toDouble();
    if (raw is String) return double.tryParse(raw);
    if (raw is Map) {
      final map = raw.cast<String, dynamic>();
      for (final key in <String>['imdb', 'tmdb', 'trakt', 'score', 'rating']) {
        final value = map[key];
        if (value is num) return value.toDouble();
        if (value is String) {
          final parsed = double.tryParse(value);
          if (parsed != null) return parsed;
        }
        if (value is Map) {
          final nested = value.cast<String, dynamic>();
          final score = nested['rating'] ?? nested['score'];
          if (score is num) return score.toDouble();
          if (score is String) return double.tryParse(score);
        }
      }
    }
    return null;
  }

  String? _textOrNull(dynamic raw) {
    final value = _text(raw);
    return value.isEmpty ? null : value;
  }

  String _text(dynamic value, [String fallback = '']) {
    if (value == null) return fallback;
    return value.toString();
  }

  int? _integer(dynamic value) {
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value);
    return null;
  }
}
