import 'dart:convert';
import 'dart:io';

import 'package:chewie/chewie.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'package:video_player/video_player.dart';

import '../../core/downloads/download_service.dart';
import '../../core/local/local_lists.dart';
import '../../core/playback/play_media.dart';
import '../../data/models/media_item.dart';
import '../../data/models/stream_source.dart';
import '../../data/repositories/catalog_repository.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_back_button.dart';
import '../../widgets/section_rail.dart';

class PlayerPage extends StatefulWidget {
  const PlayerPage({
    super.key,
    required this.url,
    required this.title,
    this.referer,
    this.local = false,
    this.type,
    this.id,
    this.sourceJson,
  });

  final String url;
  final String title;
  final String? referer;
  final bool local;
  final String? type;
  final String? id;
  final String? sourceJson;

  @override
  State<PlayerPage> createState() => _PlayerPageState();
}

class _PlayerPageState extends State<PlayerPage> {
  final CatalogRepository _catalog = CatalogRepository();
  final TextEditingController _commentController = TextEditingController();

  VideoPlayerController? _videoController;
  ChewieController? _chewieController;
  StreamSource? _stream;
  MediaItem? _item;
  List<MediaItem> _recommendations = const <MediaItem>[];
  String? _error;
  bool _loading = true;
  int _selected = 0;
  String _tab = 'forYou';

  MediaItem get _media {
    return _item ??
        MediaItem(
          id: widget.id ?? 'player:${widget.title.hashCode}',
          type: widget.type ?? 'movie',
          title: widget.title,
          poster: '',
          backdrop: '',
          description: '',
          provider: 'guest',
          genres: const <String>[],
        );
  }

  String get _commentsKey => 'comments:${_media.id}';

  List<StreamOption> get _options {
    final options = _stream?.options
            .where((option) => option.isValid || widget.local)
            .toList() ??
        const <StreamOption>[];
    if (options.isNotEmpty) return options;
    return <StreamOption>[
      StreamOption(
        url: widget.url,
        quality: 'Auto',
        type: 'video',
        language: 'Original',
      ),
    ];
  }

  StreamOption get _selectedOption {
    final options = _options;
    final index = _selected < options.length ? _selected : 0;
    return options[index];
  }

  @override
  void initState() {
    super.initState();
    _parseSource();
    _loadExtras();
    _start(_selectedOption);
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

  Future<void> _loadExtras() async {
    final type = widget.type;
    final id = widget.id;
    if (type != null && id != null && id.isNotEmpty) {
      try {
        final item = await _catalog.detail(type, id);
        if (mounted) setState(() => _item = item);
      } catch (_) {
        // Keep the player-only fallback item.
      }
    }
    try {
      final sections = await _catalog.loadHome();
      final seen = <String>{};
      final items = <MediaItem>[];
      for (final entry in sections.values) {
        for (final item in entry) {
          if (seen.add(item.id) && item.id != (widget.id ?? '')) {
            items.add(item);
          }
        }
      }
      if (mounted) setState(() => _recommendations = items.take(12).toList());
    } catch (_) {
      // Recommendations are optional.
    }
  }

  Future<void> _start(StreamOption option) async {
    await _disposeControllers();
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    final uri = Uri.tryParse(option.url);
    if (!widget.local &&
        (uri == null || (!uri.isScheme('http') && !uri.isScheme('https')))) {
      setState(() {
        _loading = false;
        _error = 'This resource does not have a playable URL.';
      });
      return;
    }

    try {
      final controller = widget.local
          ? VideoPlayerController.file(File(option.url))
          : VideoPlayerController.networkUrl(
              uri!,
              httpHeaders: <String, String>{
                if (widget.referer != null && widget.referer!.isNotEmpty)
                  'Referer': widget.referer!,
                'User-Agent': 'Mozilla/5.0 (Linux; Android; Flix4U)',
              },
            );
      await controller.initialize();
      if (!mounted) {
        await controller.dispose();
        return;
      }
      final chewie = ChewieController(
        videoPlayerController: controller,
        autoPlay: true,
        looping: false,
        aspectRatio: controller.value.aspectRatio,
        allowFullScreen: true,
        allowMuting: true,
        showControlsOnInitialize: false,
        materialProgressColors: ChewieProgressColors(
          playedColor: AppColors.accent,
          handleColor: AppColors.accentSoft,
          bufferedColor: AppColors.step4,
          backgroundColor: AppColors.step3,
        ),
      );
      setState(() {
        _videoController = controller;
        _chewieController = chewie;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Playback failed: ${_friendly(error)}';
      });
    }
  }

  Future<void> _disposeControllers() async {
    _chewieController?.dispose();
    _chewieController = null;
    final controller = _videoController;
    _videoController = null;
    if (controller != null) await controller.dispose();
  }

  String _friendly(Object error) {
    final raw = error.toString().replaceFirst('Exception: ', '');
    if (raw.contains('SocketException') || raw.contains('Failed to resolve')) {
      return 'Check your internet connection.';
    }
    if (raw.contains('404') || raw.contains('not found')) {
      return 'This source is unavailable right now.';
    }
    return raw.length > 90 ? raw.substring(0, 90) : raw;
  }

  Future<void> _download() async {
    final option = _selectedOption;
    try {
      await DownloadService.start(
        _media,
        option,
        referer: widget.referer,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Downloading ${option.label} · ${_media.title}'),
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Download: ${_friendly(error)}')),
        );
      }
    }
  }

  Future<void> _share() async {
    try {
      await SharePlus.instance.share(
        ShareParams(
          text: 'Watch ${_media.title} on Flix4U — guest mode, no login.',
        ),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Share failed: ${_friendly(error)}')),
        );
      }
    }
  }

  Future<void> _addToList() async {
    final added = await LocalLists.toggle(LocalLists.watchlist, _media);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            added ? 'Added to My List.' : 'Removed from My List.',
          ),
        ),
      );
    }
  }

  void _showGuestInfo() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 4, 18, 22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              const Text(
                'Flix4U guest mode',
                style: TextStyle(
                  color: AppColors.text,
                  fontSize: 19,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 10),
              const Text(
                'Everything here is unlocked for guests: browsing, playback, '
                'resources, downloads and local comments. No sign-up and no '
                'payment screen.',
                style: TextStyle(color: AppColors.muted, height: 1.5),
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () {
                    Navigator.pop(sheetContext);
                    context.go('/');
                  },
                  child: const Text('Browse featured titles'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showResources() {
    final options = _options;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 4, 16, 10),
              child: Row(
                children: <Widget>[
                  Text(
                    'Playback resources',
                    style: TextStyle(
                      color: AppColors.text,
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: options.length,
                itemBuilder: (context, index) {
                  final option = options[index];
                  final active = index == _selected;
                  return ListTile(
                    leading: Icon(
                      active
                          ? Icons.check_circle_rounded
                          : Icons.play_circle_outline_rounded,
                      color: active ? AppColors.accent : AppColors.muted,
                    ),
                    title: Text(
                      option.label,
                      style: const TextStyle(
                        color: AppColors.text,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    subtitle: Text(
                      '${option.quality} · ${option.type.toUpperCase()}',
                      style: const TextStyle(color: AppColors.muted),
                    ),
                    onTap: () {
                      Navigator.pop(sheetContext);
                      setState(() => _selected = index);
                      _start(option);
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _commentController.dispose();
    _chewieController?.dispose();
    _videoController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final option = _selectedOption;
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Stack(
        children: <Widget>[
          CustomScrollView(
            slivers: <Widget>[
              SliverToBoxAdapter(child: _player()),
              SliverToBoxAdapter(child: _info()),
              SliverToBoxAdapter(child: _actions()),
              SliverToBoxAdapter(child: _resources(option)),
              SliverToBoxAdapter(child: _promo()),
              SliverToBoxAdapter(child: _tabs()),
              if (_tab == 'forYou')
                SliverToBoxAdapter(
                  child: SectionRail(
                    title: 'For you',
                    subtitle: 'More like this',
                    items: _recommendations,
                    onTap: (item) => playMedia(context, item),
                  ),
                )
              else
                SliverToBoxAdapter(child: _comments()),
              const SliverToBoxAdapter(child: SizedBox(height: 110)),
            ],
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 14,
            child: Center(
              child: SizedBox(
                width: 190,
                height: 48,
                child: FilledButton.icon(
                  onPressed: _download,
                  icon: const Icon(Icons.download_rounded, size: 22),
                  label: const Text('Download', style: TextStyle(fontSize: 17)),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.accent,
                    foregroundColor: AppColors.step1,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(24),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _player() {
    return Container(
      height: 232,
      color: Colors.black,
      child: Stack(
        children: <Widget>[
          if (_chewieController != null)
            Center(
              child: Chewie(controller: _chewieController!),
            )
          else if (_loading)
            const Center(
              child: CircularProgressIndicator(color: AppColors.accent),
            )
          else
            Center(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    const Icon(
                      Icons.play_circle_outline_rounded,
                      color: AppColors.accentSoft,
                      size: 44,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      _error ?? 'This resource could not be played.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.text, fontSize: 13),
                    ),
                    const SizedBox(height: 10),
                    OutlinedButton.icon(
                      onPressed: () => _start(_selectedOption),
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            ),
          Positioned(
            left: 8,
            top: 8,
            child: Container(
              decoration: const BoxDecoration(
                color: Color(0xAA04202E),
                shape: BoxShape.circle,
              ),
              child: const AppBackButton(fallback: '/'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _info() {
    final meta = <String>[
      if (_media.year != null) '${_media.year}',
      if (_media.country != null && _media.country!.isNotEmpty) _media.country!,
      if (_media.genres.isNotEmpty) _media.genres.take(2).join(', '),
    ].join('  ·  ');
    return Padding(
      padding: const EdgeInsets.fromLTRB(13, 14, 13, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  _media.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.text,
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              InkWell(
                onTap: () => context.push(
                  '/detail/${_media.type}/${Uri.encodeComponent(_media.id)}',
                ),
                child: const Row(
                  children: <Widget>[
                    Text(
                      'Info',
                      style: TextStyle(color: AppColors.muted, fontSize: 13),
                    ),
                    Icon(
                      Icons.chevron_right_rounded,
                      size: 17,
                      color: AppColors.muted,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 7),
          Text(
            [
              if (_media.rating != null)
                '★ ${_media.rating!.toStringAsFixed(1)}',
              meta,
            ].where((part) => part.isNotEmpty).join('   |   '),
            style: const TextStyle(color: AppColors.muted, fontSize: 12.5),
          ),
        ],
      ),
    );
  }

  Widget _actions() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(13, 14, 13, 0),
      child: SizedBox(
        height: 36,
        child: ListView(
          scrollDirection: Axis.horizontal,
          children: <Widget>[
            _chip(
              icon: Icons.add_rounded,
              label: 'Add to list',
              onTap: _addToList,
            ),
            const SizedBox(width: 9),
            _chip(
              icon: Icons.share_outlined,
              label: 'Share',
              onTap: _share,
            ),
            const SizedBox(width: 9),
            _chip(
              icon: Icons.download_outlined,
              label: 'Download',
              onTap: _download,
            ),
            const SizedBox(width: 9),
            _chip(
              icon: Icons.visibility_outlined,
              label: 'View',
              onTap: () => context.push(
                '/detail/${_media.type}/${Uri.encodeComponent(_media.id)}',
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _chip({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 13),
        decoration: BoxDecoration(
          color: AppColors.step3.withOpacity(0.55),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppColors.step4.withOpacity(0.55)),
        ),
        child: Row(
          children: <Widget>[
            Icon(icon, size: 17, color: AppColors.accentSoft),
            const SizedBox(width: 7),
            Text(
              label,
              style: const TextStyle(
                color: AppColors.text,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _resources(StreamOption option) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.fromLTRB(13, 28, 13, 0),
          child: Row(
            children: <Widget>[
              const Text(
                'Resources',
                style: TextStyle(
                  color: AppColors.text,
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'Guest upload',
                style: TextStyle(color: AppColors.muted, fontSize: 13),
              ),
              const Spacer(),
              IconButton(
                onPressed: _showGuestInfo,
                tooltip: 'About resources',
                icon: const Icon(
                  Icons.help_outline_rounded,
                  color: AppColors.muted,
                  size: 18,
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(13, 12, 13, 0),
          child: InkWell(
            onTap: _showResources,
            borderRadius: BorderRadius.circular(6),
            child: Container(
              width: 150,
              height: 34,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: AppColors.accentSoft.withOpacity(0.55)),
              ),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      option.shortLabel,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.text,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const Icon(
                    Icons.keyboard_arrow_down_rounded,
                    size: 17,
                    color: AppColors.text,
                  ),
                ],
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
          child: Container(
            height: 48,
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(6),
              gradient: AppColors.resourceGradient,
            ),
            child: Text(
              '${_media.title} [${option.language}][${option.quality}]',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.text,
                fontSize: 14,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _promo() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(13, 30, 13, 0),
      child: Container(
        height: 190,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: <Color>[AppColors.step3, AppColors.step2, AppColors.step1],
          ),
          border: Border.all(color: AppColors.accentSoft.withOpacity(0.30)),
        ),
        child: Stack(
          children: <Widget>[
            const Center(
              child: Icon(
                Icons.workspace_premium_outlined,
                size: 64,
                color: AppColors.accentSoft,
              ),
            ),
            Positioned(
              right: 9,
              bottom: 9,
              child: FilledButton(
                onPressed: _showGuestInfo,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.accent,
                  foregroundColor: AppColors.step1,
                  minimumSize: const Size(0, 31),
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(5),
                  ),
                ),
                child: const Text('Check Now', style: TextStyle(fontSize: 13)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tabs() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 32, 14, 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: <Widget>[
          _tabButton(
            label: 'For you',
            selected: _tab == 'forYou',
            onTap: () => setState(() => _tab = 'forYou'),
          ),
          const SizedBox(width: 24),
          _tabButton(
            label: 'Comments',
            selected: _tab == 'comments',
            onTap: () => setState(() => _tab = 'comments'),
          ),
        ],
      ),
    );
  }

  Widget _tabButton({
    required String label,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Column(
        children: <Widget>[
          Text(
            label,
            style: TextStyle(
              color: selected ? AppColors.text : AppColors.muted,
              fontSize: selected ? 17 : 15,
              fontWeight: selected ? FontWeight.w900 : FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Container(
            width: 34,
            height: selected ? 3 : 1,
            color: selected ? AppColors.accent : AppColors.step3,
          ),
        ],
      ),
    );
  }

  Widget _comments() {
    return ValueListenableBuilder(
      valueListenable: Hive.box('library').listenable(),
      builder: (context, _, __) {
        final comments = LocalLists.comments(_commentsKey);
        return Padding(
          padding: const EdgeInsets.fromLTRB(13, 14, 13, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(
                    child: TextField(
                      controller: _commentController,
                      style: const TextStyle(color: AppColors.text),
                      decoration: InputDecoration(
                        hintText: 'Add a local comment',
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: () async {
                      final text = _commentController.text;
                      if (text.trim().isEmpty) return;
                      await LocalLists.addComment(_commentsKey, text);
                      _commentController.clear();
                    },
                    child: const Text('Post'),
                  ),
                ],
              ),
              if (comments.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 28),
                  child: Center(
                    child: Text(
                      'No comments yet. Start the conversation.',
                      style: TextStyle(color: AppColors.muted, fontSize: 13),
                    ),
                  ),
                )
              else
                Column(
                  children: comments.map((comment) {
                    return Container(
                      margin: const EdgeInsets.only(top: 8),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.step3),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          const CircleAvatar(
                            radius: 16,
                            backgroundColor: AppColors.step4,
                            child: Icon(
                              Icons.person_rounded,
                              size: 16,
                              color: AppColors.step1,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Text(
                                  (comment['author'] ?? 'You').toString(),
                                  style: const TextStyle(
                                    color: AppColors.text,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 12.5,
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  (comment['text'] ?? '').toString(),
                                  style: const TextStyle(
                                    color: AppColors.muted,
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                ),
            ],
          ),
        );
      },
    );
  }
}
