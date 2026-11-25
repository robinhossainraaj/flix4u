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
              headers: const <String, dynamic>{'Accept': 'application/json'},
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
      countryOfOrigin
    }
  }
}
''';

  static const List<String> _languages = <String>[
    'Hindi',
    'English',
    'Tamil',
    'Telugu',
    'Bengali',
    'Arabic',
    'French',
    'Spanish',
    'Japanese',
    'Korean',
    'Chinese',
    'Portuguese',
    'Russian',
    'Italian',
  ];

  static String _languageFrom(String text) {
    final lower = text.toLowerCase();
    for (final language in _languages) {
      if (lower.contains(language.toLowerCase())) return language;
    }
    return 'Original';
  }

  static String _text(dynamic value, [String fallback = '']) {
    if (value == null) return fallback;
    if (value is List) return value.join(', ');
    return value.toString();
  }

  static String _countryFrom(Map<String, dynamic> doc) {
    final value = doc['country'] ?? doc['countryOfOrigin'] ?? doc['country_iso'];
    return _text(value);
  }

  List<Map<String, dynamic>> _archiveDocs(List<dynamic> docs, String type) {
    return docs
        .whereType<Map>()
        .map((raw) {
          final doc = raw.cast<String, dynamic>();
          final identifier = _text(doc['identifier']);
          final subject = doc['subject'];
          final genres = subject is List
              ? subject.take(6).map((g) => g.toString()).toList()
              : <String>[];
          final title = _text(doc['title'], identifier);
          final year = int.tryParse(_text(doc['year']));
          final description = _text(doc['description']);
          return <String, dynamic>{
            'id': 'archive:$type:$identifier',
            'identifier': identifier,
            'type': type == 'tv' ? 'tv' : 'movie',
            'title': title,
            'poster': identifier.isEmpty
                ? ''
                : '$_archive/services/img/${Uri.encodeComponent(identifier)}',
            'backdrop': identifier.isEmpty
                ? ''
                : '$_archive/services/img/${Uri.encodeComponent(identifier)}',
            'description': description,
            'provider': 'archive',
            'genres': genres,
            'year': year,
            'rating': null,
            'country': _countryFrom(doc),
            'language': _languageFrom('$title $description'),
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
    String collection = '',
  }) async {
    // Archive.org's `mediatype:tv` bucket is almost empty. Real series live in
    // the movies bucket, so filter by text instead of an invalid media type.
    final base = switch (type) {
      'short' => 'mediatype:movies AND (short OR clip)',
      'music' => 'mediatype:movies AND (music OR musical OR concert)',
      'tv' => 'mediatype:movies AND (series OR episode OR tv)',
      _ => 'mediatype:movies',
    };
    final safeQuery = query.trim().replaceAll(RegExp(r'["\\]'), ' ');
    final queryClause = safeQuery.isEmpty ? '' : ' AND ($safeQuery)';
    final resolvedCollection = collection.isNotEmpty
        ? collection
        : switch (type) {
            'tv' => 'classic_tv',
            'short' => 'short_films',
            'music' => 'etree',
            _ => '',
          };
    final collectionClause = resolvedCollection.isEmpty
        ? ''
        : 'collection:$resolvedCollection AND ';
    final q = '$collectionClause$base$queryClause AND format:"MPEG4"';
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
          'country',
          'language',
        ],
        'rows': rows,
        'page': page,
        'output': 'json',
        'sort[]': sort,
      },
    );
    final docs =
        (response.data?['response']?['docs'] as List?) ?? const <dynamic>[];
    return _archiveDocs(docs, type == 'tv' ? 'tv' : 'movie');
  }

  List<Map<String, dynamic>> _anilistMedia(List<dynamic> media) {
    return media.whereType<Map>().map((raw) {
      final item = raw.cast<String, dynamic>();
      final title = (item['title'] ?? const <String, dynamic>{}) as Map;
      final cover = (item['coverImage'] ?? const <String, dynamic>{}) as Map;
      final description = _text(
        item['description'],
      ).replaceAll(RegExp(r'<[^>]*>'), '');
      final score = item['averageScore'];
      final name = _text(
        title['romaji'] ?? title['english'] ?? title['native'],
        'Untitled',
      );
      return <String, dynamic>{
        'id': 'anilist:${item['id'] ?? ''}',
        'type': 'anime',
        'title': name,
        'poster': _text(cover['extraLarge'] ?? cover['large']),
        'backdrop': _text(item['bannerImage']),
        'description': description,
        'provider': 'anilist',
        'genres': item['genres'] is List
            ? (item['genres'] as List).map((g) => g.toString()).toList()
            : <String>[],
        'year': item['seasonYear'],
        'rating': score is num ? score / 10 : null,
        'country': _text(item['countryOfOrigin']),
        'language': _languageFrom('$name $description'),
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
      safe(
        () => archiveSearch(
          '',
          'movie',
          rows: 16,
          collection: 'feature_films',
        ),
      ),
      safe(
        () => archiveSearch(
          '',
          'movie',
          rows: 16,
          collection: 'silent_films',
        ),
      ),
      safe(
        () => archiveSearch(
          'adventure OR action OR comedy',
          'movie',
          rows: 16,
          collection: 'feature_films',
        ),
      ),
      safe(() => archiveSearch('', 'tv', rows: 16)),
      safe(() => archiveSearch('documentary', 'movie', rows: 16)),
      safe(() => anilist(perPage: 16, sort: const <String>['TRENDING_DESC'])),
      safe(() => anilist(perPage: 16, sort: const <String>['POPULARITY_DESC'])),
      safe(() => archiveSearch('', 'short', rows: 16)),
      safe(() => archiveSearch('', 'music', rows: 16)),
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
      'shorts': jobs[7],
      'music': jobs[8],
    };
  }

  Future<List<Map<String, dynamic>>> search(String query, String type) async {
    if (type == 'anime') return anilist(search: query, perPage: 20);
    if (type == 'tv') return archiveSearch(query, 'tv', rows: 20);
    if (type == 'short') return archiveSearch(query, 'short', rows: 20);
    if (type == 'music') return archiveSearch(query, 'music', rows: 20);
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
      if (id == null) throw const FormatException('Invalid AniList id');
      final items = await anilist(id: id, perPage: 1);
      if (items.isEmpty) throw StateError('Anime not found');
      return items.first;
    }
    throw UnsupportedError('Unsupported media id: $rawId');
  }

  static String _qualityFor(String name, dynamic size) {
    final lower = name.toLowerCase();
    if (lower.contains('2160') || lower.contains('4k')) {
      return '2160p 4K · MP4';
    }
    if (lower.contains('1080')) return '1080p HD · MP4';
    if (lower.contains('720')) return '720p HD · MP4';
    if (lower.contains('480')) return '480p SD · MP4';
    final bytes = size is num ? size.toInt() : 0;
    if (bytes > 1200000000) return 'HD · MP4';
    if (bytes > 300000000) return 'SD · MP4';
    return 'Auto · MP4';
  }

  Future<Map<String, dynamic>> resolveStream(String rawId, String title) async {
    String identifier = '';
    if (rawId.startsWith('archive:')) {
      identifier = rawId.split(':').last;
    } else if (title.isNotEmpty) {
      final results = await archiveSearch(title, 'movie', rows: 12);
      for (final item in results) {
        final candidate = _text(item['identifier']);
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
          ).hasMatch(_text(f['name'])),
        )
        .toList();
    if (playable.isEmpty) {
      throw StateError('No playable video file was found for this item.');
    }
    playable.sort((a, b) {
      final left = a['size'] is num ? (a['size'] as num).toInt() : 0;
      final right = b['size'] is num ? (b['size'] as num).toInt() : 0;
      return right.compareTo(left);
    });

    final sources = playable.take(8).map((file) {
      final name = _text(file['name']);
      return <String, dynamic>{
        'url':
            '$_archive/download/${Uri.encodeComponent(identifier)}/${Uri.encodeComponent(name)}',
        'quality': _qualityFor(name, file['size']),
        'type': name.split('.').last.toLowerCase(),
        'language': _languageFrom('$name $title'),
      };
    }).toList();

    return <String, dynamic>{
      'sources': sources,
      'subtitles': <dynamic>[],
      'headers': <String, dynamic>{
        'Referer': '$_archive/',
        'User-Agent': 'Mozilla/5.0 (Linux; Android; Flix4U)',
      },
      'provider': 'archive',
      'title': title,
    };
  }
}
