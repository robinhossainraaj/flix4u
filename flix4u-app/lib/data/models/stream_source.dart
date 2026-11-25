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
}

class StreamSource {
  const StreamSource({
    required this.url,
    required this.quality,
    required this.type,
    required this.referer,
    required this.provider,
    required this.subtitles,
  });

  final String url;
  final String quality;
  final String type;
  final String referer;
  final String provider;
  final List<SubtitleTrack> subtitles;

  factory StreamSource.fromJson(Map<String, dynamic> json) {
    final sources = json['sources'];
    final first = sources is List && sources.isNotEmpty && sources.first is Map
        ? (sources.first as Map).cast<String, dynamic>()
        : <String, dynamic>{};
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

    return StreamSource(
      url: _text(first['url']),
      quality: _text(first['quality'], 'Auto'),
      type: _text(first['type'], 'hls'),
      referer: referer,
      provider: _text(json['provider'], 'unknown'),
      subtitles: parsedSubs,
    );
  }

  bool get isValid => url.startsWith('http://') || url.startsWith('https://');
}
