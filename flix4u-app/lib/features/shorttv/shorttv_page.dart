import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import 'package:video_player/video_player.dart';

import '../../core/local/local_lists.dart';
import '../../core/playback/play_media.dart';
import '../../data/models/media_item.dart';
import '../../data/repositories/catalog_repository.dart';
import '../../data/repositories/stream_repository.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_bottom_nav.dart';

class ShortTvPage extends StatefulWidget {
  const ShortTvPage({super.key});

  @override
  State<ShortTvPage> createState() => _ShortTvPageState();
}

class _ShortTvPageState extends State<ShortTvPage> {
  final CatalogRepository _catalog = CatalogRepository();
  final StreamRepository _streams = StreamRepository();
  final PageController _pageController = PageController();

  List<MediaItem> _items = const <MediaItem>[];
  int _current = 0;
  int _generation = 0;
  bool _loadingList = true;
  bool _loadingVideo = false;
  String? _videoError;
  VideoPlayerController? _controller;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final sections = await _catalog.loadHome();
      var items = sections['shorts'] ?? const <MediaItem>[];
      if (items.isEmpty) items = sections['trending'] ?? const <MediaItem>[];
      if (mounted) setState(() => _items = items.take(20).toList());
      _startVideo(0);
    } catch (_) {
      // Keep the empty state.
    } finally {
      if (mounted) setState(() => _loadingList = false);
    }
  }

  Future<void> _startVideo(int index) async {
    final generation = ++_generation;
    await _disposeVideo();
    if (!mounted || index >= _items.length) return;
    final item = _items[index];
    setState(() {
      _loadingVideo = true;
      _videoError = null;
    });
    try {
      final source = await _streams.resolve(
        provider: item.provider,
        id: item.id,
        type: item.type,
        title: item.title,
      );
      final option = source.preferred;
      if (option == null) throw StateError('No public short video found.');
      final uri = Uri.parse(option.url);
      final controller = VideoPlayerController.networkUrl(
        uri,
        httpHeaders: <String, String>{
          if (source.referer.isNotEmpty) 'Referer': source.referer,
          'User-Agent': 'Mozilla/5.0 (Linux; Android; Flix4U)',
        },
      );
      await controller.initialize();
      if (generation != _generation || !mounted) {
        await controller.dispose();
        return;
      }
      controller.setLooping(true);
      await controller.play();
      setState(() {
        _controller = controller;
        _loadingVideo = false;
      });
    } catch (error) {
      if (generation != _generation || !mounted) return;
      setState(() {
        _loadingVideo = false;
        _videoError = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _disposeVideo() async {
    final controller = _controller;
    _controller = null;
    if (controller != null) await controller.dispose();
  }

  void _togglePlay() {
    final controller = _controller;
    if (controller == null) return;
    setState(() {
      if (controller.value.isPlaying) {
        controller.pause();
      } else {
        controller.play();
      }
    });
  }

  Future<void> _share(MediaItem item) async {
    try {
      await SharePlus.instance.share(
        ShareParams(text: 'Watch ${item.title} on Flix4U ShortTV.'),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Share failed: $error')),
        );
      }
    }
  }

  Future<void> _save(MediaItem item) async {
    final added = await LocalLists.toggle(LocalLists.watchlist, item);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(added ? 'Saved to My List.' : 'Removed from My List.'),
        ),
      );
    }
  }

  @override
  void dispose() {
    _generation++;
    _pageController.dispose();
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: <Widget>[
          if (_loadingList)
            const Center(
              child: CircularProgressIndicator(color: AppColors.accent),
            )
          else if (_items.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(28),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    const Icon(
                      Icons.smart_display_rounded,
                      size: 56,
                      color: AppColors.accentSoft,
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'No short videos available right now.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.text, fontSize: 16),
                    ),
                    const SizedBox(height: 14),
                    FilledButton(
                      onPressed: () => context.go('/'),
                      child: const Text('Back to Home'),
                    ),
                  ],
                ),
              ),
            )
          else
            PageView.builder(
              controller: _pageController,
              scrollDirection: Axis.vertical,
              itemCount: _items.length,
              onPageChanged: (index) {
                setState(() => _current = index);
                _startVideo(index);
              },
              itemBuilder: (context, index) =>
                  _shortPage(_items[index], index),
            ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: AppBottomNav(selectedIndex: 1),
          ),
        ],
      ),
    );
  }

  Widget _shortPage(MediaItem item, int index) {
    final active = index == _current;
    return Container(
      color: Colors.black,
      child: Stack(
        fit: StackFit.expand,
        children: <Widget>[
          if (active && _controller != null && _controller!.value.isInitialized)
            FittedBox(
              fit: BoxFit.cover,
              child: SizedBox(
                width: _controller!.value.size.width,
                height: _controller!.value.size.height,
                child: VideoPlayer(_controller!),
              ),
            )
          else if (item.backdrop.isNotEmpty || item.poster.isNotEmpty)
            Image.network(
              item.backdrop.isNotEmpty ? item.backdrop : item.poster,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => const DecoratedBox(
                decoration: BoxDecoration(gradient: AppColors.cardGradient),
              ),
            )
          else
            const DecoratedBox(decoration: BoxDecoration(gradient: AppColors.cardGradient)),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: <Color>[
                  Color(0x6604202E),
                  Color(0x0004202E),
                  Color(0xDD04202E),
                ],
                stops: <double>[0, 0.45, 1],
              ),
            ),
          ),
          if (active)
            Positioned.fill(
              child: GestureDetector(
                onTap: _togglePlay,
                child: Center(
                  child: _loadingVideo
                      ? const CircularProgressIndicator(color: AppColors.accent)
                      : _videoError != null
                      ? const Icon(
                          Icons.play_circle_outline_rounded,
                          color: AppColors.accentSoft,
                          size: 64,
                        )
                      : _controller != null &&
                            !_controller!.value.isPlaying
                      ? const Icon(
                          Icons.play_circle_fill_rounded,
                          color: AppColors.accentSoft,
                          size: 64,
                        )
                      : const SizedBox.shrink(),
                ),
              ),
            ),
          Positioned(
            left: 14,
            top: 14,
            child: Text(
              'ShortTV  ${index + 1}/${_items.length}',
              style: const TextStyle(
                color: AppColors.text,
                fontSize: 13,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          Positioned(
            right: 10,
            bottom: 96,
            child: Column(
              children: <Widget>[
                _action(
                  icon: Icons.favorite_border_rounded,
                  label: 'Save',
                  onTap: () => _save(item),
                ),
                const SizedBox(height: 18),
                _action(
                  icon: Icons.share_outlined,
                  label: 'Share',
                  onTap: () => _share(item),
                ),
                const SizedBox(height: 18),
                _action(
                  icon: Icons.open_in_full_rounded,
                  label: 'Player',
                  onTap: () => playMedia(context, item),
                ),
              ],
            ),
          ),
          Positioned(
            left: 14,
            right: 80,
            bottom: 88,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  item.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.text,
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  '${item.languageLabel} · ${item.genres.take(2).join(', ')}',
                  style: const TextStyle(color: AppColors.accentSoft, fontSize: 12),
                ),
                if (active && _videoError != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      _videoError!,
                      maxLines: 2,
                      style: const TextStyle(
                        color: Color(0xFFFFB4A2),
                        fontSize: 11,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _action({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Column(
        children: <Widget>[
          Container(
            width: 42,
            height: 42,
            decoration: const BoxDecoration(
              color: Color(0xAA04202E),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: AppColors.text, size: 22),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              color: AppColors.text,
              fontSize: 10,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
