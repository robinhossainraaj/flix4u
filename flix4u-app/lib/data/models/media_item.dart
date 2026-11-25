List<String> _stringList(dynamic value) {
  if (value is List) {
    return value.map((e) => e.toString()).toList();
  }
  return const <String>[];
}

double? _double(dynamic value) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}

int? _integer(dynamic value) {
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}

String _text(dynamic value, [String fallback = '']) {
  if (value == null) return fallback;
  return value.toString();
}

class MediaItem {
  const MediaItem({
    required this.id,
    required this.type,
    required this.title,
    required this.poster,
    required this.backdrop,
    required this.description,
    required this.provider,
    required this.genres,
    this.year,
    this.rating,
    this.country,
    this.language,
    this.imdbId,
    this.extras = const <String, dynamic>{},
  });

  final String id;
  final String type;
  final String title;
  final String poster;
  final String backdrop;
  final String description;
  final String provider;
  final List<String> genres;
  final int? year;
  final double? rating;
  final String? country;
  final String? language;
  final String? imdbId;
  final Map<String, dynamic> extras;

  factory MediaItem.fromJson(Map<String, dynamic> json) {
    return MediaItem(
      id: _text(json['id']),
      type: _text(json['type'], 'movie'),
      title: _text(json['title'], 'Untitled'),
      poster: _text(json['poster']),
      backdrop: _text(json['backdrop']),
      description: _text(json['description']),
      provider: _text(json['provider'], 'tmdb'),
      genres: _stringList(json['genres']),
      year: _integer(json['year']),
      rating: _double(json['rating']),
      country: json['country'] == null ? null : _text(json['country']),
      language: json['language'] == null ? null : _text(json['language']),
      imdbId: json['imdbId'] == null ? null : _text(json['imdbId']),
      extras: json['extras'] is Map
          ? (json['extras'] as Map).cast<String, dynamic>()
          : <String, dynamic>{},
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'type': type,
    'title': title,
    'poster': poster,
    'backdrop': backdrop,
    'description': description,
    'provider': provider,
    'genres': genres,
    'year': year,
    'rating': rating,
    'country': country,
    'language': language,
    'imdbId': imdbId,
    'extras': extras,
  };

  String get languageLabel {
    final match = RegExp(
      r'\[([^\]]+)\]',
    ).firstMatch(title)?.group(1)?.trim();
    if (match != null && match.isNotEmpty) return match;
    if (language != null && language!.isNotEmpty) return language!;
    if (provider.toLowerCase().contains('hindi')) return 'Hindi';
    return 'Original';
  }
}
