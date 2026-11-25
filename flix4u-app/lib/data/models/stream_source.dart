String _text(dynamic value, [String fallback = '']) {
  if (value == null) return fallback;
  return value.toString();
}

class SubtitleTrack {
  const SubtitleTrack({required this.url, required this.label});

  final String url;
  final String label;

  factory SubtitleTrack.fromJson(Map<String, dynamic> json) {
    return SubtitleTrack(
      url: _text(json['url']),
      label: _text(json['label'], 'Subtitles'),
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'url': url,
    'label': label,
  };
}

/// A single selectable playback resource (quality / language / host).
class StreamOption {
  const StreamOption({
    required this.url,
    required this.quality,
    required this.type,
    required this.language,
  });

  final String url;
  final String quality;
  final String type;
  final String language;

  factory StreamOption.fromJson(dynamic value, [int index = 0]) {
    if (value is String) {
      return StreamOption(
        url: value,
        quality: 'Source ${index + 1}',
        type: 'video',
        language: 'Original',
      );
    }
    final json = value is Map
        ? value.cast<String, dynamic>()
        : <String, dynamic>{};
    final rawQuality = _text(json['quality'], '');
    final url = _text(json['url']);
    return StreamOption(
      url: url,
      quality: rawQuality.isEmpty ? 'Source ${index + 1}' : rawQuality,
      type: _text(json['type'], 'video'),
      language: _language(_text(json['language']), rawQuality, url),
    );
  }

  static String _language(String explicit, String quality, String url) {
    if (explicit.isNotEmpty) return explicit;
    final haystack = '$quality $url';
    const languages = <String>[
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
    for (final language in languages) {
      if (haystack.toLowerCase().contains(language.toLowerCase())) {
        return language;
      }
    }
    return 'Original';
  }

  bool get isValid => url.startsWith('http://') || url.startsWith('https://');

  String get label => language == 'Original' ? quality : '$language · $quality';

  String get shortLabel => language == 'Original' ? 'Original' : language;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'url': url,
    'quality': quality,
    'type': type,
    'language': language,
  };
}

class StreamSource {
  const StreamSource({
    required this.url,
    required this.quality,
    required this.type,
    required this.referer,
    required this.provider,
    required this.subtitles,
    List<StreamOption>? options,
  }) : options = options ??
            <StreamOption>[
              StreamOption(
                url: url,
                quality: quality.isEmpty ? 'Auto' : quality,
                type: type.isEmpty ? 'video' : type,
                language: 'Original',
              ),
            ];

  final String url;
  final String quality;
  final String type;
  final String referer;
  final String provider;
  final List<SubtitleTrack> subtitles;
  final List<StreamOption> options;

  factory StreamSource.fromJson(Map<String, dynamic> json) {
    final rawSources = json['sources'];
    final parsed = <StreamOption>[];
    if (rawSources is List) {
      for (var i = 0; i < rawSources.length; i++) {
        parsed.add(StreamOption.fromJson(rawSources[i], i));
      }
    }
    final headers = json['headers'];
    String referer = '';
    if (headers is Map) {
      referer = _text(headers['Referer'] ?? headers['referer']);
    }

    final subs = json['subtitles'];
    final parsedSubs = <SubtitleTrack>[];
    if (subs is List) {
      for (final item in subs) {
        if (item is Map) {
          parsedSubs.add(SubtitleTrack.fromJson(item.cast<String, dynamic>()));
        }
      }
    }

    final primary = parsed.isEmpty
        ? StreamOption(
            url: _text(json['url']),
            quality: _text(json['quality'], 'Auto'),
            type: _text(json['type'], 'hls'),
            language: 'Original',
          )
        : parsed.first;

    return StreamSource(
      url: primary.url,
      quality: primary.quality,
      type: primary.type,
      referer: referer,
      provider: _text(json['provider'], 'unknown'),
      subtitles: parsedSubs,
      options: parsed,
    );
  }

  bool get isValid => options.any((option) => option.isValid);

  StreamOption? get preferred {
    for (final option in options) {
      if (option.isValid) return option;
    }
    return null;
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'url': url,
    'quality': quality,
    'type': type,
    'referer': referer,
    'provider': provider,
    'sources': options.map((e) => e.toJson()).toList(),
    'subtitles': subtitles.map((e) => e.toJson()).toList(),
  };
}
