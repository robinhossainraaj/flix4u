import 'dart:convert';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../../data/models/media_item.dart';
import '../../data/repositories/catalog_repository.dart';
import '../../data/repositories/stream_repository.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_back_button.dart';

class DetailPage extends StatefulWidget {
  const DetailPage({super.key, required this.type, required this.id});

  final String type;
  final String id;

  @override
  State<DetailPage> createState() => _DetailPageState();
}

class _DetailPageState extends State<DetailPage> {
  final CatalogRepository _catalog = CatalogRepository();
  final StreamRepository _streams = StreamRepository();
  final TextEditingController _episodeController = TextEditingController(
    text: '1',
  );
  bool _resolving = false;

  Box get _library => Hive.box('library');

  List<String> _saved(String key) {
    final value = _library.get(key);
    if (value is! List) return const <String>[];
    return value.map((e) => e.toString()).toList();
  }

  bool _has(String key, MediaItem item) =>
      _saved(key).contains(jsonEncode(item.toJson()));

  void _toggle(String key, MediaItem item) {
    final items = _saved(key);
    final encoded = jsonEncode(item.toJson());
    if (items.contains(encoded)) {
      items.remove(encoded);
    } else {
      items.add(encoded);
    }
    _library.put(key, items);
    setState(() {});
  }

  void _setEpisode(int episode) {
    _episodeController.text = episode.toString();
    setState(() {});
  }

  Future<void> _play(MediaItem item) async {
    setState(() => _resolving = true);
    try {
      final stream = await _streams.resolve(
        provider: item.provider,
        id: item.id,
        type: item.type,
        title: item.title,
        episode: _episodeController.text.trim().isEmpty
            ? '1'
            : _episodeController.text.trim(),
      );
      if (!stream.isValid) {
        throw const FormatException('Backend returned no playable stream URL.');
      }

      final encoded = jsonEncode(item.toJson());
      final continueList = _saved('continueWatching')
        ..removeWhere((e) => e != encoded);
      continueList.insert(0, encoded);
      await _library.put('continueWatching', continueList.take(20).toList());

      if (!mounted) return;
      context.push(
        '/player?url=${Uri.encodeComponent(stream.url)}'
        '&title=${Uri.encodeComponent(item.title)}'
        '&referer=${Uri.encodeComponent(stream.referer)}',
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not resolve stream: $error')),
      );
    } finally {
      if (mounted) setState(() => _resolving = false);
    }
  }

  @override
  void dispose() {
    _episodeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: FutureBuilder<MediaItem>(
        future: _catalog.detail(widget.type, widget.id),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || !snapshot.hasData) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'Could not load details: ${snapshot.error}',
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }
          final item = snapshot.data!;
          final episodeBased = item.type == 'anime' || item.type == 'tv';
          return CustomScrollView(
            slivers: <Widget>[
              SliverAppBar(
                expandedHeight: 300,
                pinned: true,
                leading: const AppBackButton(),
                flexibleSpace: FlexibleSpaceBar(
                  title: Text(
                    item.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  titlePadding: const EdgeInsets.only(left: 20, bottom: 18),
                  background: _backdrop(item),
                ),
                actions: <Widget>[
                  IconButton(
                    tooltip: 'Favorite',
                    icon: Icon(
                      _has('favorites', item)
                          ? Icons.favorite
                          : Icons.favorite_border,
                      color: _has('favorites', item)
                          ? AppColors.danger
                          : Colors.white,
                    ),
                    onPressed: () => _toggle('favorites', item),
                  ),
                  IconButton(
                    tooltip: 'Watchlist',
                    icon: Icon(
                      _has('watchlist', item)
                          ? Icons.bookmark
                          : Icons.bookmark_border,
                    ),
                    onPressed: () => _toggle('watchlist', item),
                  ),
                ],
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Row(
                        children: <Widget>[
                          _pill(_typeLabel(item.type), AppColors.primary),
                          const SizedBox(width: 8),
                          if (item.year != null)
                            _pill(item.year.toString(), AppColors.surfaceAlt),
                          const SizedBox(width: 8),
                          if (item.rating != null)
                            _pill(
                              '★ ${item.rating!.toStringAsFixed(1)}',
                              AppColors.surfaceAlt,
                            ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: _resolving ? null : () => _play(item),
                          icon: _resolving
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.play_arrow_rounded),
                          label: Text(
                            _resolving ? 'Resolving stream...' : 'Play now',
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => _toggle('watchlist', item),
                              icon: Icon(
                                _has('watchlist', item)
                                    ? Icons.bookmark
                                    : Icons.bookmark_border,
                              ),
                              label: Text(
                                _has('watchlist', item)
                                    ? 'In watchlist'
                                    : 'Watchlist',
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => _toggle('favorites', item),
                              icon: Icon(
                                _has('favorites', item)
                                    ? Icons.favorite
                                    : Icons.favorite_border,
                                color: _has('favorites', item)
                                    ? AppColors.danger
                                    : null,
                              ),
                              label: const Text('Favorite'),
                            ),
                          ),
                        ],
                      ),
                      if (episodeBased) ...<Widget>[
                        const SizedBox(height: 24),
                        const Text(
                          'Choose episode',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 10),
                        SizedBox(
                          height: 38,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: 12,
                            separatorBuilder: (_, __) =>
                                const SizedBox(width: 8),
                            itemBuilder: (context, index) {
                              final episode = index + 1;
                              final selected =
                                  _episodeController.text == episode.toString();
                              return ChoiceChip(
                                label: Text('EP $episode'),
                                selected: selected,
                                onSelected: (_) => _setEpisode(episode),
                                selectedColor: AppColors.primary,
                                backgroundColor: AppColors.surfaceAlt,
                                side: BorderSide.none,
                              );
                            },
                          ),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: _episodeController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Or enter episode number',
                            prefixIcon: Icon(Icons.numbers),
                          ),
                        ),
                      ],
                      const SizedBox(height: 24),
                      const Text(
                        'About',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        item.description.isEmpty
                            ? 'No description available.'
                            : item.description.replaceAll(
                                RegExp(r'<[^>]*>'),
                                '',
                              ),
                        style: const TextStyle(
                          color: Colors.white70,
                          height: 1.5,
                        ),
                      ),
                      if (item.genres.isNotEmpty) ...<Widget>[
                        const SizedBox(height: 18),
                        const Text(
                          'Genres',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: item.genres
                              .map(
                                (g) => Chip(
                                  label: Text(g),
                                  backgroundColor: AppColors.surfaceAlt,
                                ),
                              )
                              .toList(),
                        ),
                      ],
                      const SizedBox(height: 20),
                      Text(
                        'Source: ${item.provider.toUpperCase()}  •  Guest access',
                        style: const TextStyle(
                          color: Colors.white30,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _backdrop(MediaItem item) {
    final image = item.backdrop.isNotEmpty ? item.backdrop : item.poster;
    return Stack(
      fit: StackFit.expand,
      children: <Widget>[
        if (image.isNotEmpty)
          CachedNetworkImage(
            imageUrl: image,
            fit: BoxFit.cover,
            placeholder: (_, __) => const _BackdropGradient(),
            errorWidget: (_, __, ___) => const _BackdropGradient(),
          )
        else
          const _BackdropGradient(),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: <Color>[
                Color(0x3308080D),
                Color(0x9908080D),
                AppColors.background,
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _pill(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  String _typeLabel(String type) {
    switch (type) {
      case 'tv':
        return 'WEB SERIES';
      case 'anime':
        return 'ANIME';
      default:
        return 'MOVIE';
    }
  }
}

class _BackdropGradient extends StatelessWidget {
  const _BackdropGradient();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: <Color>[AppColors.surfaceAlt, AppColors.deepest],
        ),
      ),
    );
  }
}
