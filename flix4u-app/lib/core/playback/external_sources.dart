/// Public player pages that can be opened in the device browser.
///
/// These are links only. Flix4U does not scrape them, bypass ads, or extract
/// protected media. Native playback continues to use direct HLS/MP4 resources.
class ExternalSource {
  const ExternalSource({required this.label, required this.url});

  final String label;
  final String url;
}

List<ExternalSource> buildExternalSources({
  required String type,
  required String id,
  String? imdbId,
  int season = 1,
  int episode = 1,
}) {
  final sources = <ExternalSource>[];
  final safeSeason = season < 1 ? 1 : season;
  final safeEpisode = episode < 1 ? 1 : episode;
  final isTv = type == 'tv';
  final isAnime = type == 'anime';

  final tmdb = _tmdbId(id);
  if (tmdb != null && !isAnime) {
    final movie = isTv ? null : tmdb.toString();
    final tv = isTv ? tmdb.toString() : null;
    if (movie != null) {
      sources.add(ExternalSource(
        label: 'VidSrc',
        url: 'https://vsembed.su/embed/movie/$movie',
      ));
      sources.add(ExternalSource(
        label: 'Vidfast',
        url: 'https://vidfast.vc/movie/$movie',
      ));
      sources.add(ExternalSource(
        label: 'Vidlove',
        url: 'https://player.vidlove.cc/embed/movie/$movie',
      ));
      sources.add(ExternalSource(
        label: 'Vidrift',
        url: 'https://embed.vidrift.net/embed/movie/$movie',
      ));
      sources.add(ExternalSource(
        label: 'Vidnest',
        url: 'https://vidnest.fun/movie/$movie',
      ));
      sources.add(ExternalSource(
        label: 'Frembed',
        url: 'https://frembed.uno/embed/movie/$movie',
      ));
    }
    if (tv != null) {
      sources.add(ExternalSource(
        label: 'VidSrc',
        url: 'https://vsembed.su/embed/tv/$tv/$safeSeason/$safeEpisode',
      ));
      sources.add(ExternalSource(
        label: 'Vidfast',
        url: 'https://vidfast.vc/tv/$tv/$safeSeason/$safeEpisode',
      ));
      sources.add(ExternalSource(
        label: 'Vidlove',
        url: 'https://player.vidlove.cc/embed/tv/$tv/$safeSeason/$safeEpisode',
      ));
      sources.add(ExternalSource(
        label: 'Vidrift',
        url: 'https://embed.vidrift.net/embed/tv/$tv/$safeSeason/$safeEpisode',
      ));
      sources.add(ExternalSource(
        label: 'Vidnest',
        url: 'https://vidnest.fun/tv/$tv/$safeSeason/$safeEpisode',
      ));
      sources.add(ExternalSource(
        label: 'Frembed',
        url: 'https://frembed.uno/embed/serie/$tv?sa=$safeSeason&epi=$safeEpisode',
      ));
    }
  }

  final imdb = _imdbId(id) ?? imdbId;
  if (imdb != null && !isAnime) {
    sources.add(
      ExternalSource(
        label: 'DeVideoSrc',
        url: isTv
            ? 'https://devideosrc.co/custom/serial/$imdb/$safeSeason/$safeEpisode'
            : 'https://devideosrc.co/custom/movie/$imdb',
      ),
    );
  }

  final anilist = _anilistId(id);
  if (anilist != null && (isAnime || tmdb == null)) {
    sources.add(ExternalSource(
      label: 'Vidnest sub',
      url: 'https://vidnest.fun/anime/$anilist/$safeEpisode/sub',
    ));
    sources.add(ExternalSource(
      label: 'Vidnest dub',
      url: 'https://vidnest.fun/anime/$anilist/$safeEpisode/dub',
    ));
  }

  final seen = <String>{};
  return sources.where((source) => seen.add(source.url)).toList();
}

int? _tmdbId(String raw) {
  final value = raw.trim();
  final match = RegExp(r'^tmdb:(movie|tv):(\d+)$').firstMatch(value);
  if (match != null) return int.tryParse(match.group(2) ?? '');
  if (RegExp(r'^\d+$').hasMatch(value)) return int.tryParse(value);
  return null;
}

String? _imdbId(String raw) {
  final match = RegExp(r'^imdb:(tt\d+)$').firstMatch(raw.trim());
  return match?.group(1);
}

String? _anilistId(String raw) {
  final match = RegExp(r'^anilist:(\d+)$').firstMatch(raw.trim());
  return match?.group(1);
}
