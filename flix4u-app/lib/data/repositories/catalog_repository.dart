import '../../core/api/api_client.dart';
import '../../core/api/direct_data_source.dart';
import '../../core/api/endpoints.dart';
import '../../core/api/github_catalog_data_source.dart';
import '../models/media_item.dart';
import 'reeldb_repository.dart';

class CatalogRepository {
  CatalogRepository({
    ApiClient? api,
    DirectDataSource? direct,
    ReelDbRepository? reeldb,
    GithubCatalogDataSource? github,
  }) : _api = api ?? ApiClient(),
      _direct = direct ?? DirectDataSource(),
      _reeldb = reeldb ?? ReelDbRepository(api: api),
      _github = github ?? GithubCatalogDataSource();

  final ApiClient _api;
  final DirectDataSource _direct;
  final ReelDbRepository _reeldb;
  final GithubCatalogDataSource _github;

  List<MediaItem> _itemsFrom(dynamic value) {
    if (value is! List) return const <MediaItem>[];
    return value
        .whereType<Map>()
        .map((e) => MediaItem.fromJson(e.cast<String, dynamic>()))
        .toList();
  }

  List<MediaItem> _merge(List<MediaItem> first, List<MediaItem> second) {
    final seen = <String>{};
    return <MediaItem>[...first, ...second]
        .where((item) => item.id.isNotEmpty && seen.add(item.id))
        .toList();
  }

  Future<Map<String, List<MediaItem>>> loadHome() async {
    try {
      final json = await _api.getJson(Endpoints.home);
      if (json.isNotEmpty) {
        return json.map((key, value) => MapEntry(key, _itemsFrom(value)));
      }
    } catch (_) {
      // fall through to the committed GitHub catalog
    }
    final github = await _github.home();
    if (github.isNotEmpty) {
      return github.map((key, value) => MapEntry(key, _itemsFrom(value)));
    }
    final json = await _direct.home();
    return json.map((key, value) => MapEntry(key, _itemsFrom(value)));
  }

  Future<List<MediaItem>> trending({String type = 'all'}) async {
    try {
      final json = await _api.getJson(
        Endpoints.trending,
        query: <String, dynamic>{'type': type},
      );
      final items = _itemsFrom(json['items'] ?? json['results']);
      if (items.isNotEmpty) return items;
    } catch (_) {
      // fall through
    }

    final sections = await _github.home();
    final key = switch (type) {
      'anime' => 'anime',
      'tv' => 'webSeries',
      'short' => 'shorts',
      'music' => 'music',
      _ => 'trending',
    };
    final githubItems = _itemsFrom(sections[key]);
    if (githubItems.isNotEmpty) return githubItems;

    final items = await _direct.search(
      '',
      type == 'tv'
          ? 'tv'
          : type == 'anime'
          ? 'anime'
          : 'movie',
    );
    return items.map((e) => MediaItem.fromJson(e)).toList();
  }

  Future<List<MediaItem>> search(String query, {String type = 'all'}) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return const <MediaItem>[];
    try {
      final json = await _api.getJson(
        Endpoints.search,
        query: <String, dynamic>{'q': trimmed, 'type': type},
      );
      final items = _itemsFrom(json['items'] ?? json['results']);
      if (items.isNotEmpty) return items;
    } catch (_) {
      // fall through
    }

    final results = await Future.wait<List<MediaItem>>([
      _github.search(trimmed, type).then((items) => _itemsFrom(items)),
      _direct.search(trimmed, type).then(
        (items) => items.map((e) => MediaItem.fromJson(e)).toList(),
      ),
    ]);
    final merged = _merge(results[0], results[1]);
    if (merged.isNotEmpty) return merged;

    if (isBackendConfigured && type != 'anime') {
      final reelItems = await _reeldb.search(trimmed, type: type);
      if (reelItems.isNotEmpty) return reelItems;
    }
    return const <MediaItem>[];
  }

  Future<MediaItem> detail(String type, String id) async {
    try {
      final json = await _api.getJson(
        '${Endpoints.detail}/$type/${Uri.encodeComponent(id)}',
      );
      if (json.isNotEmpty && json['id'] != null) {
        return MediaItem.fromJson(json);
      }
    } catch (_) {
      // fall through
    }

    final githubItem = await _github.detail(type, id);
    if (githubItem != null) return MediaItem.fromJson(githubItem);

    if (isBackendConfigured && type != 'anime') {
      final enriched = await _reeldb.detail(type, id);
      if (enriched != null) return enriched;
    }
    final json = await _direct.detail(type, id);
    return MediaItem.fromJson(json);
  }
}
