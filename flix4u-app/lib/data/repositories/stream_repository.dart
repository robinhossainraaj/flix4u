import '../../core/api/api_client.dart';
import '../../core/api/direct_data_source.dart';
import '../../core/api/endpoints.dart';
import '../models/stream_source.dart';

class StreamRepository {
  StreamRepository({ApiClient? api, DirectDataSource? direct})
    : _api = api ?? ApiClient(),
      _direct = direct ?? DirectDataSource();

  final ApiClient _api;
  final DirectDataSource _direct;

  Future<StreamSource> resolve({
    required String provider,
    required String id,
    required String type,
    String? episode,
    String? title,
  }) async {
    final query = <String, dynamic>{
      'provider': provider,
      'id': id,
      'type': type,
    };
    if (episode != null && episode.isNotEmpty) {
      query['episode'] = episode;
    }
    if (title != null && title.isNotEmpty) {
      query['title'] = title;
    }

    try {
      final json = await _api.getJson(Endpoints.resolveStream, query: query);
      final source = StreamSource.fromJson(json);
      if (source.isValid) return source;
    } catch (_) {
      // fall through to public API fallback
    }

    final json = await _direct.resolveStream(id, title ?? '');
    return StreamSource.fromJson(json);
  }
}
