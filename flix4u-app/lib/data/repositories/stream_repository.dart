import 'package:dio/dio.dart';

import '../../core/api/api_client.dart';
import '../../core/api/direct_data_source.dart';
import '../../core/api/endpoints.dart';
import '../models/stream_source.dart';

class StreamRepository {
  StreamRepository({ApiClient? api, DirectDataSource? direct, Dio? cineproDio})
    : _api = api ?? ApiClient(),
      _direct = direct ?? DirectDataSource(),
      _cinepro = cineproDio ??
          Dio(
            BaseOptions(
              baseUrl: kCineproBaseUrl.isEmpty
                  ? 'http://127.0.0.1:3000'
                  : kCineproBaseUrl,
              connectTimeout: const Duration(seconds: 5),
              receiveTimeout: const Duration(seconds: 15),
              headers: const <String, dynamic>{'Accept': 'application/json'},
            ),
          );

  final ApiClient _api;
  final DirectDataSource _direct;
  final Dio _cinepro;

  Future<StreamSource> resolve({
    required String provider,
    required String id,
    required String type,
    String? episode,
    String? title,
  }) async {
    final tmdb = _parseTmdbId(id);
    if (kCineproBaseUrl.isNotEmpty && tmdb != null && type != 'anime') {
      try {
        final cinepro = await _resolveCinepro(
          tmdb.value,
          tmdb.key,
          episode,
        );
        if (cinepro != null && cinepro.isValid) return cinepro;
      } catch (_) {
        // Fall through to the Flix4U backend and public APIs.
      }
    }

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

  /// Accepts `tmdb:movie:123`, `tmdb:tv:123`, or a bare numeric TMDB ID.
  MapEntry<String, int>? _parseTmdbId(String id) {
    final match = RegExp(r'^tmdb:(movie|tv):(\d+)$').firstMatch(id.trim());
    if (match != null) {
      final value = int.tryParse(match.group(2) ?? '');
      if (value != null && value > 0) {
        return MapEntry<String, int>(match.group(1)!, value);
      }
      return null;
    }
    if (RegExp(r'^\d+$').hasMatch(id.trim())) {
      final value = int.tryParse(id.trim());
      if (value != null && value > 0) {
        return MapEntry<String, int>('movie', value);
      }
    }
    return null;
  }

  Future<StreamSource?> _resolveCinepro(
    int tmdbId,
    String kind,
    String? rawEpisode,
  ) async {
    final episode = int.tryParse(rawEpisode ?? '') ?? 1;
    final safeEpisode = episode < 1 ? 1 : episode;
    final path = kind == 'tv'
        ? '/v1/tv/$tmdbId/seasons/1/episodes/$safeEpisode'
        : '/v1/movies/$tmdbId';
    final response = await _cinepro.get<Map<String, dynamic>>(path);
    final json = response.data;
    if (json == null) return null;

    final mapped = <Map<String, dynamic>>[];
    final sources = json['sources'];
    if (sources is List) {
      for (final raw in sources) {
        if (raw is! Map) continue;
        final source = raw.cast<String, dynamic>();
        final url = _absolute(_text(source['url']));
        if (!_isPlayable(url)) continue;
        final provider = _providerName(source['provider']);
        final quality = _text(source['quality'], 'Auto');
        mapped.add(<String, dynamic>{
          'url': url,
          'quality': provider.isEmpty ? quality : '$provider · $quality',
          'type': _text(source['type'], 'hls'),
          'language': _language(source['audioTracks']),
        });
      }
    }
    if (mapped.isEmpty) return null;

    final subtitles = <Map<String, dynamic>>[];
    final rawSubs = json['subtitles'];
    if (rawSubs is List) {
      for (final raw in rawSubs) {
        if (raw is! Map) continue;
        final sub = raw.cast<String, dynamic>();
        final url = _absolute(_text(sub['url']));
        if (!_isPlayable(url)) continue;
        subtitles.add(<String, dynamic>{
          'url': url,
          'label': _text(sub['label'], 'Subtitles'),
        });
      }
    }

    return StreamSource.fromJson(<String, dynamic>{
      'url': mapped.first['url'],
      'quality': mapped.first['quality'],
      'type': mapped.first['type'],
      'referer': '',
      'provider': 'cinepro',
      'sources': mapped,
      'subtitles': subtitles,
    });
  }

  String _absolute(String raw) {
    if (raw.isEmpty) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    if (kCineproBaseUrl.isEmpty) return '';
    return Uri.parse(kCineproBaseUrl).resolve(raw).toString();
  }

  bool _isPlayable(String url) {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  String _providerName(dynamic raw) {
    if (raw is! Map) return '';
    final provider = raw.cast<String, dynamic>();
    return _text(provider['name'], _text(provider['id']));
  }

  String _language(dynamic raw) {
    if (raw is! List || raw.isEmpty || raw.first is! Map) return 'Original';
    final track = (raw.first as Map).cast<String, dynamic>();
    return _text(track['label'], _text(track['language'], 'Original'));
  }

  String _text(dynamic value, [String fallback = '']) {
    if (value == null) return fallback;
    return value.toString();
  }
}
