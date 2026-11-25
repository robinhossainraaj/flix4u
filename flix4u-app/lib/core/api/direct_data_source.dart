import 'package:dio/dio.dart';

/// Public fallback data source used when no Flix4U backend is configured.
///
/// It reads only public, unauthenticated APIs:
///   - Archive.org advancedsearch / metadata for free movies and series
///   - AniList GraphQL for anime catalog metadata
class DirectDataSource {
  DirectDataSource({Dio? dio})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              connectTimeout: const Duration(seconds: 10),
              receiveTimeout: const Duration(seconds: 20),
              headers: const {'Accept': 'application/json'},
            ),
          );

  final Dio _dio;
  static const String _archive = 'https://archive.org';
  static const String _anilist = 'https://graphql.anilist.co';

  static const String _anilistQuery = r'''
query ($page: Int, $perPage: Int, $search: String, $id: Int, $sort: [MediaSort]) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, sort: $sort, search: $search, id: $id) {
      id
      title { romaji english native }
      coverImage { extraLarge large }
      bannerImage
      description
      genres
      seasonYear
      averageScore
    }
  }
}
''';

  List<Map<String, dynamic>> _archiveDocs(List<dynamic> docs, String type) {
    return docs
        .whereType<Map>()
        .map((raw) {
          final doc = raw.cast<String, dynamic>();
          final identifier = (doc['identifier'] ?? '').toString();
          final subject = doc['subject'];
          final genres = subject is List
              ? subject.take(6).map((g) => g.toString()).toList()
              : <String>[];
          final yearRaw = doc['year']?.toString() ?? '';
          final year = int.tryParse(yearRaw);
          return <String, dynamic>{
            'id': 'archive:$type:$identifier',
            'identifier': identifier,
            'type': type,
            'title': (doc['title'] ?? identifier).toString(),
            'poster': identifier.isEmpty
                ? ''
                : '$_archive/services/img/${Uri.encodeComponent(identifier)}',
            'backdrop': identifier.isEmpty
                ? ''
                : '$_archive/services/img/${Uri.encodeComponent(identifier)}',
            'description': (doc['description'] ?? '').toString(),
            'provider': 'archive',
            'genres': genres,
            'year': year,
            'rating': null,
          };
        })
        .where((item) => (item['identifier'] as String).isNotEmpty)
        .toList();
  }

  Future<List<Map<String, dynamic>>> archiveSearch(
    String query,
    String type, {
    int page = 1,
    int rows = 12,
    String sort = 'downloads desc',
  }) async {
    final mediatype = type == 'tv' ? 'tv' : 'movies';
    final safeQuery = query.trim().replaceAll(RegExp(r'["\\]'), ' ');
    final q = safeQuery.isEmpty
        ? '$mediatype AND format:"MPEG4"'
        : '$mediatype AND ($safeQuery) AND format:"MPEG4"';
    final response = await _dio.get<Map<String, dynamic>>(
      '$_archive/advancedsearch.php',
      queryParameters: <String, dynamic>{
        'q': q,
        'fl[]': <String>[
          'identifier',
          'title',
          'description',
          'subject',
          'year',
        ],
        'rows': rows,
        'page': page,
        'output': 'json',
        'sort[]': sort,
      },
    );
    final docs =
        (response.data?['response']?['docs'] as List?) ?? const <dynamic>[];
    return _archiveDocs(docs, type);
  }

  List<Map<String, dynamic>> _anilistMedia(List<dynamic> media) {
    return media.whereType<Map>().map((raw) {
      final item = raw.cast<String, dynamic>();
      final title = (item['title'] ?? const <String, dynamic>{}) as Map;
      final cover = (item['coverImage'] ?? const <String, dynamic>{}) as Map;
      final description = (item['description'] ?? '').toString().replaceAll(
        RegExp(r'<[^>]*>'),
        '',
      );
      final score = item['averageScore'];
      return <String, dynamic>{
        'id': 'anilist:${item['id'] ?? ''}',
        'type': 'anime',
        'title':
            (title['romaji'] ??
                    title['english'] ??
                    title['native'] ??
                    'Untitled')
                .toString(),
        'poster': (cover['extraLarge'] ?? cover['large'] ?? '').toString(),
        'backdrop': (item['bannerImage'] ?? '').toString(),
        'description': description,
        'provider': 'anilist',
        'genres': item['genres'] is List
            ? (item['genres'] as List).map((g) => g.toString()).toList()
            : <String>[],
        'year': item['seasonYear'],
        'rating': score is num ? score / 10 : null,
      };
    }).toList();
  }

  Future<List<Map<String, dynamic>>> anilist({
    String? search,
    int? id,
    int page = 1,
    int perPage = 12,
    List<String>? sort,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      _anilist,
      data: <String, dynamic>{
        'query': _anilistQuery,
        'variables': <String, dynamic>{
          'page': page,
          'perPage': perPage,
          if (search != null && search.isNotEmpty) 'search': search,
          if (id != null) 'id': id,
          if (sort != null && sort.isNotEmpty) 'sort': sort,
        },
      },
    );
    final media =
        (((response.data?['data'] as Map?)?['Page'] as Map?)?['media']
            as List?) ??
        const <dynamic>[];
    return _anilistMedia(media);
  }

  Future<Map<String, dynamic>> home() async {
    Future<List<Map<String, dynamic>>> safe(
      Future<List<Map<String, dynamic>>> Function() job,
    ) {
      return job().catchError((_) => <Map<String, dynamic>>[]);
    }

    final jobs = await Future.wait([
      safe(() => archiveSearch('', 'movie', rows: 16)),
      safe(
        () => archiveSearch('classic OR vintage OR silent', 'movie', rows: 16),
      ),
      safe(
        () => archiveSearch('adventure OR action OR comedy', 'movie', rows: 16),
      ),
      safe(() => archiveSearch('', 'tv', rows: 16)),
      safe(() => archiveSearch('series OR documentary', 'tv', rows: 16)),
      safe(() => anilist(perPage: 16, sort: const <String>['TRENDING_DESC'])),
      safe(() => anilist(perPage: 16, sort: const <String>['POPULARITY_DESC'])),
    ]);
    return <String, dynamic>{
      'trending': jobs[0],
      'freeMovies': jobs[0],
      'classicMovies': jobs[1],
      'adventure': jobs[2],
      'movies': jobs[2],
      'webSeries': jobs[3],
      'classicSeries': jobs[4],
      'documentarySeries': jobs[4],
      'anime': jobs[5],
      'popularAnime': jobs[6],
    };
  }

  Future<List<Map<String, dynamic>>> search(String query, String type) async {
    if (type == 'anime') return anilist(search: query, perPage: 20);
    if (type == 'tv') return archiveSearch(query, 'tv', rows: 20);
    if (type == 'movie') return archiveSearch(query, 'movie', rows: 20);
    final jobs = await Future.wait([
      archiveSearch(
        query,
        'movie',
        rows: 10,
      ).catchError((_) => <Map<String, dynamic>>[]),
      archiveSearch(
        query,
        'tv',
        rows: 10,
      ).catchError((_) => <Map<String, dynamic>>[]),
      anilist(
        search: query,
        perPage: 10,
      ).catchError((_) => <Map<String, dynamic>>[]),
    ]);
    return <Map<String, dynamic>>[...jobs[0], ...jobs[1], ...jobs[2]];
  }

  Future<Map<String, dynamic>> detail(String type, String rawId) async {
    final parts = rawId.split(':');
    if (parts.first == 'archive') {
      final identifier = parts.last;
      final response = await _dio.get<Map<String, dynamic>>(
        '$_archive/metadata/${Uri.encodeComponent(identifier)}',
      );
      final metadata =
          (response.data?['metadata'] as Map?)?.cast<String, dynamic>() ??
          <String, dynamic>{};
      return _archiveDocs(<dynamic>[
        <String, dynamic>{...metadata, 'identifier': identifier},
      ], type == 'tv' ? 'tv' : 'movie').first;
    }
    if (parts.first == 'anilist') {
      final id = int.tryParse(parts.last);
      if (id == null) throw FormatException('Invalid AniList id');
      final items = await anilist(id: id, perPage: 1);
      if (items.isEmpty) throw StateError('Anime not found');
      return items.first;
    }
    throw UnsupportedError('Unsupported media id: $rawId');
  }

  Future<Map<String, dynamic>> resolveStream(String rawId, String title) async {
    String identifier = '';
    if (rawId.startsWith('archive:')) {
      identifier = rawId.split(':').last;
    } else if (title.isNotEmpty) {
      final results = await archiveSearch(title, 'movie', rows: 12);
      for (final item in results) {
        final candidate = (item['identifier'] ?? '').toString();
        if (candidate.isNotEmpty) {
          identifier = candidate;
          break;
        }
      }
    }
    if (identifier.isEmpty) {
      throw StateError('No public stream source found.');
    }

    final response = await _dio.get<Map<String, dynamic>>(
      '$_archive/metadata/${Uri.encodeComponent(identifier)}',
    );
    final files = (response.data?['files'] as List?) ?? const <dynamic>[];
    final playable = files
        .whereType<Map>()
        .map((f) => f.cast<String, dynamic>())
        .where(
          (f) => RegExp(
            r'\.(mp4|m4v|webm)$',
            caseSensitive: false,
          ).hasMatch((f['name'] ?? '').toString()),
        )
        .toList();
    if (playable.isEmpty) {
      throw StateError('No playable video file was found for this item.');
    }
    final chosen = playable.first;
    final name = (chosen['name'] ?? '').toString();
    return <String, dynamic>{
      'sources': <dynamic>[
        <String, dynamic>{
          'url':
              '$_archive/download/${Uri.encodeComponent(identifier)}/${Uri.encodeComponent(name)}',
          'quality': 'Auto · MP4',
          'type': 'mp4',
        },
      ],
      'subtitles': <dynamic>[],
      'headers': <String, dynamic>{'Referer': '$_archive/'},
      'provider': 'archive',
      'title': title,
    };
  }
}
