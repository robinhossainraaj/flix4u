import 'package:dio/dio.dart';

import 'endpoints.dart';

/// Reads the public JSON catalog committed to this repository and published by
/// GitHub Pages. It is generated from keyless public APIs, so no credentials
/// are needed in the app.
class GithubCatalogDataSource {
  GithubCatalogDataSource({Dio? dio})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              connectTimeout: const Duration(seconds: 8),
              receiveTimeout: const Duration(seconds: 15),
              headers: const <String, dynamic>{'Accept': 'application/json'},
            ),
          );

  final Dio _dio;
  Map<String, dynamic>? _cache;

  Future<Map<String, dynamic>?> load() async {
    final cached = _cache;
    if (cached != null) return cached;
    for (final url in <String>[kGithubCatalogUrl, kGithubCatalogRawUrl]) {
      try {
        final response = await _dio.get<dynamic>(
          url,
          options: Options(
            headers: const <String, dynamic>{'Cache-Control': 'no-cache'},
          ),
        );
        final json = response.data;
        if (json is! Map) continue;
        final map = json.cast<String, dynamic>();
        if (map['items'] is! List || map['home'] is! Map) continue;
        _cache = map;
        return map;
      } catch (_) {
        // Try the next public URL.
      }
    }
    return null;
  }

  Future<Map<String, List<Map<String, dynamic>>>> home() async {
    final catalog = await load();
    if (catalog == null) return const <String, List<Map<String, dynamic>>>{};
    final rawHome = (catalog['home'] as Map).cast<String, dynamic>();
    return rawHome.map(
      (key, value) => MapEntry(key, _items(value)),
    );
  }

  Future<List<Map<String, dynamic>>> search(
    String query,
    String type,
  ) async {
    final catalog = await load();
    if (catalog == null) return const <Map<String, dynamic>>[];
    final all = _items(catalog['items']);
    final nullable = query.trim().toLowerCase();
    final candidates = all.where((item) => _matchesType(item, type)).toList();
    if (nullable.isEmpty) {
      return candidates.take(30).toList();
    }

    final tokens = nullable
        .split(RegExp(r'\s+'))
        .where((token) => token.isNotEmpty)
        .toList();
    final scored = <MapEntry<Map<String, dynamic>, int>>[];
    for (final item in candidates) {
      final title = _text(item['title']).toLowerCase();
      final description = _text(item['description']).toLowerCase();
      final genres = (item['genres'] as List?)?.map((g) => g.toString().toLowerCase()).toList() ??
          const <String>[];
      var score = 0;
      if (title.contains(nullable)) score += 120;
      for (final token in tokens) {
        if (title.contains(token)) score += 40;
        if (genres.any((genre) => genre.contains(token))) score += 12;
        if (description.contains(token)) score += 3;
      }
      if (score > 0) {
        scored.add(MapEntry<Map<String, dynamic>, int>(item, score));
      }
    }
    scored.sort((a, b) => b.value.compareTo(a.value));
    return scored.take(40).map((entry) => entry.key).toList();
  }

  Future<Map<String, dynamic>?> detail(String type, String id) async {
    final catalog = await load();
    if (catalog == null) return null;
    for (final item in _items(catalog['items'])) {
      if (_text(item['id']) == id) return item;
    }
    return null;
  }

  List<Map<String, dynamic>> _items(dynamic value) {
    if (value is! List) return const <Map<String, dynamic>>[];
    return value
        .whereType<Map>()
        .map((item) => item.cast<String, dynamic>())
        .where((item) => _text(item['id']).isNotEmpty)
        .toList();
  }

  bool _matchesType(Map<String, dynamic> item, String type) {
    final rawType = _text(item['type']);
    final id = _text(item['id']);
    switch (type) {
      case 'anime':
        return rawType == 'anime';
      case 'tv':
        return rawType == 'tv';
      case 'short':
        return id.contains(':short:');
      case 'music':
        return id.contains(':music:');
      case 'movie':
        return rawType == 'movie' && !id.contains(':short:');
      default:
        return true;
    }
  }

  String _text(dynamic value, [String fallback = '']) {
    if (value == null) return fallback;
    return value.toString();
  }
}
