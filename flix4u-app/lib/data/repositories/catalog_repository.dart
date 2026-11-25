import '../../core/api/api_client.dart';
import '../../core/api/direct_data_source.dart';
import '../../core/api/endpoints.dart';
import '../models/media_item.dart';
import 'reeldb_repository.dart';

class CatalogRepository {
  CatalogRepository({
    ApiClient? api,
    DirectDataSource? direct,
    ReelDbRepository? reeldb,
  }) : _api = api ?? ApiClient(),
      _direct = direct ?? DirectDataSource(),
      _reeldb = reeldb ?? ReelDbRepository(api: api);

  final ApiClient _api;
  final DirectDataSource _direct;
  final ReelDbRepository _reeldb;

  List<MediaItem> _itemsFrom(dynamic value) {
    if (value is! List) return const <MediaItem>[];
    return value
        .whereType<Map>()
        .map((e) => MediaItem.fromJson(e.cast<String, dynamic>()))
        .toList();
  }

  Future<Map<String, List<MediaItem>>> loadHome() async {
    try {
      final json = await _api.getJson(Endpoints.home);
      if (json.isNotEmpty) {
        return json.map((key, value) => MapEntry(key, _itemsFrom(value)));
      }
    } catch (_) {
      // fall through to public APIs
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
    if (type != 'anime') {
      final reelItems = await _reeldb.search(trimmed, type: type);
      if (reelItems.isNotEmpty) return reelItems;
    }
    final items = await _direct.search(trimmed, type);
    return items.map((e) => MediaItem.fromJson(e)).toList();
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
    if (type != 'anime') {
      final enriched = await _reeldb.detail(type, id);
      if (enriched != null) return enriched;
    }
    final json = await _direct.detail(type, id);
    return MediaItem.fromJson(json);
  }
}
