import 'dart:convert';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/downloads/download_service.dart';
import '../../core/playback/external_sources.dart';
import '../../core/local/local_lists.dart';
import '../../core/playback/play_media.dart';
import '../../data/models/media_item.dart';
import '../../data/models/stream_source.dart';
import '../../data/repositories/catalog_repository.dart';
import '../../data/repositories/stream_repository.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_back_button.dart';
import '../../widgets/skeleton_loading.dart';

class DetailPage extends StatefulWidget {
  const DetailPage({
    super.key,
    required this.type,
    required this.id,
    this.sourceJson,
    this.referer,
  });

  final String type;
  final String id;
  final String? sourceJson;
  final String? referer;

  @override
  State<DetailPage> createState() => _DetailPageState();
}

class _DetailPageState extends State<DetailPage> {
  final CatalogRepository _catalog = CatalogRepository();
  final StreamRepository _streams = StreamRepository();
  Future<MediaItem>? _detailFuture;
  StreamSource? _stream;
  MediaItem? _loaded;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _parseSource();
    _detailFuture = _catalog.detail(widget.type, widget.id);
    _detailFuture!.then((item) {
      if (mounted) setState(() => _loaded = item);
    }).catchError((_) {});
  }

  void _reloadDetail() {
    final future = _catalog.detail(widget.type, widget.id);
    setState(() => _detailFuture = future);
    future.then((item) {
      if (mounted) setState(() => _loaded = item);
    }).catchError((_) {});
  }

  void _parseSource() {
    if (widget.sourceJson == null || widget.sourceJson!.isEmpty) return;
    try {
      final decoded = jsonDecode(widget.sourceJson!) as Map<String, dynamic>;
      _stream = StreamSource.fromJson(decoded);
    } catch (_) {
      _stream = null;
    }
  }

  MediaItem get _fallback => MediaItem(
    id: widget.id,
    type: widget.type,
    title: 'Title details',
    poster: '',
    backdrop: '',
    description: '',
    provider: 'guest',
    genres: const <String>[],
  );

  List<StreamOption> get _options =>
      _stream?.options.where((option) => option.isValid).toList() ??
      const <StreamOption>[];

  Future<StreamSource> _resolveStream() async {
    if (_stream != null && _stream!.isValid) return _stream!;
    final item = _loaded ?? _fallback;
    final source = await _streams.resolve(
      provider: item.provider,
      id: item.id,
      type: item.type,
      title: item.title,
      extras: item.extras,
    );
    if (mounted) setState(() => _stream = source);
    return source;
  }

  Future<void> _download() async {
    setState(() => _busy = true);
    try {
      final source = await _resolveStream();
      final option = source.preferred;
      if (option == null) throw StateError('No downloadable resource found.');
      await DownloadService.start(
        _loaded ?? _fallback,
        option,
        referer: widget.referer ?? source.referer,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Download started.')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Download failed: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _share(MediaItem item) async {
    try {
      await SharePlus.instance.share(
        ShareParams(text: 'Watch ${item.title} on Flix4U — no login needed.'),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Share failed: $error')),
        );
      }
    }
  }

  Future<void> _addToList(MediaItem item) async {
    final added = await LocalLists.toggle(LocalLists.watchlist, item);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(added ? 'Added to My List.' : 'Removed from My List.'),
        ),
      );
    }
  }

  List<String> _names(dynamic raw) {
    if (raw is! List) return const <String>[];
    final names = <String>[];
    for (final value in raw) {
      if (value is String) {
        names.add(value);
      } else if (value is Map) {
        final map = value.cast<String, dynamic>();
        final name = map['name'] ?? map['title'] ?? map['provider_name'];
        if (name != null) names.add(name.toString());
        for (final key in <String>['flatrate', 'rent', 'buy', 'providers']) {
          names.addAll(_names(map[key]));
        }
      }
    }
    final seen = <String>{};
    return names.where((name) => seen.add(name)).toList();
  }

  Widget _metadataExtras(MediaItem item) {
    final extras = item.extras;
    if (extras.isEmpty) return const SizedBox.shrink();
    final cast = _names(extras['cast']).take(8).toList();
    final providers = _names(extras['providers']).take(8).toList();
    final seasons = extras['seasons'];
    final seasonCount = seasons is List ? seasons.length : 0;
    final lines = <String>[
      if (cast.isNotEmpty) 'Cast: ${cast.join(', ')}',
      if (providers.isNotEmpty) 'Providers: ${providers.join(', ')}',
      if (seasonCount > 0) 'Seasons: $seasonCount',
    ];
    if (lines.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const Text(
            'Metadata',
            style: TextStyle(
              color: AppColors.accentSoft,
              fontSize: 13,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 7),
          ...lines.map(
            (line) => Padding(
              padding: const EdgeInsets.only(bottom: 5),
              child: Text(
                line,
                style: const TextStyle(
                  color: AppColors.muted,
                  fontSize: 12.5,
                  height: 1.4,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openExternal(ExternalSource source) async {
    final uri = Uri.tryParse(source.url);
    if (uri == null) return;
    try {
      final opened = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
      if (!opened && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open this source.')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open this source.')),
        );
      }
    }
  }

  void _showExternalSources(MediaItem item) {
    final sources = buildExternalSources(
      type: item.type,
      id: item.id,
      imdbId: item.imdbId,
    );
    if (sources.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('External sources need a TMDB, IMDb or AniList ID.'),
        ),
      );
      return;
    }
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: ListView.builder(
          shrinkWrap: true,
          itemCount: sources.length,
          itemBuilder: (context, index) {
            final source = sources[index];
            return ListTile(
              leading: const Icon(
                Icons.open_in_new_rounded,
                color: AppColors.accent,
              ),
              title: Text(
                source.label,
                style: const TextStyle(color: AppColors.text),
              ),
              subtitle: const Text(
                'Opens in your browser · no login in Flix4U',
                style: TextStyle(color: AppColors.muted, fontSize: 12),
              ),
              onTap: () {
                Navigator.pop(sheetContext);
                _openExternal(source);
              },
            );
          },
        ),
      ),
    );
  }

  void _showResources() {
    final options = _options;
    if (options.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No resources are available yet.')),
      );
      return;
    }
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: ListView.builder(
          shrinkWrap: true,
          itemCount: options.length,
          itemBuilder: (context, index) {
            final option = options[index];
            return ListTile(
              leading: const Icon(
                Icons.play_circle_outline_rounded,
                color: AppColors.accent,
              ),
              title: Text(
                option.label,
                style: const TextStyle(color: AppColors.text),
              ),
              subtitle: Text(
                '${option.quality} · ${option.type.toUpperCase()}',
                style: const TextStyle(color: AppColors.muted),
              ),
              onTap: () => Navigator.pop(sheetContext),
            );
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: FutureBuilder<MediaItem>(
        future: _detailFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting &&
              _loaded == null) {
            return const ContentSwitcher(
              stateKey: 'detail-loading',
              child: DetailSkeleton(),
            );
          }
          if (snapshot.hasError && _loaded == null) {
            return ContentSwitcher(
              stateKey: 'detail-error',
              child: SkeletonErrorState(
                title: 'Could not load details',
                message: '${snapshot.error ?? ''}',
                onRetry: _reloadDetail,
              ),
            );
          }
          final item = snapshot.data ?? _loaded ?? _fallback;
          return ContentSwitcher(
            stateKey: 'detail-content',
            child: CustomScrollView(
              slivers: <Widget>[
              SliverAppBar(
                expandedHeight: 280,
                pinned: true,
                leading: const AppBackButton(fallback: '/'),
                flexibleSpace: FlexibleSpaceBar(
                  background: _hero(item),
                  title: Text(
                    item.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                  titlePadding: const EdgeInsets.only(left: 58, bottom: 16),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        [
                          if (item.rating != null)
                            '★ ${item.rating!.toStringAsFixed(1)}',
                          '${item.year ?? ''}',
                          item.country ?? '',
                          item.genres.take(3).join(', '),
                        ].where((part) => part.isNotEmpty).join('  ·  '),
                        style: const TextStyle(
                          color: AppColors.accentSoft,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        item.description.isEmpty
                            ? 'Open-source public metadata. Press play to resolve a public stream on this device.'
                            : item.description,
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 14,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 20),
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: FilledButton.icon(
                              onPressed: () => playMedia(context, item),
                              icon: const Icon(Icons.play_arrow_rounded),
                              label: const Text('Play now'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          OutlinedButton(
                            onPressed: () => _addToList(item),
                            child: const Text('My List'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _busy ? null : _download,
                              icon: _busy
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(Icons.download_outlined),
                              label: const Text('Download'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => _share(item),
                              icon: const Icon(Icons.share_outlined),
                              label: const Text('Share'),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _showResources,
                              icon: const Icon(Icons.video_file_outlined),
                              label: const Text('Resources'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => _showExternalSources(item),
                              icon: const Icon(Icons.open_in_new_rounded),
                              label: const Text('Sources'),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      _metadataExtras(item),
                      const SizedBox(height: 12),
                    ],
                  ),
                ),
              ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _hero(MediaItem item) {
    final image = item.backdrop.isNotEmpty ? item.backdrop : item.poster;
    return Stack(
      fit: StackFit.expand,
      children: <Widget>[
        if (image.isNotEmpty)
          CachedNetworkImage(
            imageUrl: image,
            fit: BoxFit.cover,
            errorWidget: (_, __, ___) => const _HeroFallback(),
            placeholder: (_, __) => const Shimmer(
              child: SkeletonBox(
                width: double.infinity,
                height: double.infinity,
                radius: 0,
              ),
            ),
          )
        else
          const _HeroFallback(),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: <Color>[
                Color(0x3304202E),
                Color(0xDD04202E),
                AppColors.background,
              ],
              stops: <double>[0, 0.62, 1],
            ),
          ),
        ),
      ],
    );
  }
}

class _HeroFallback extends StatelessWidget {
  const _HeroFallback();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(decoration: BoxDecoration(gradient: AppColors.highlightGradient));
  }
}
