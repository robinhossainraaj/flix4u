import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/media_item.dart';
import '../../data/repositories/catalog_repository.dart';
import '../../data/repositories/stream_repository.dart';
import '../../data/sample_data.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_bottom_nav.dart';
import '../../widgets/hero_carousel.dart';
import '../../widgets/section_rail.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  static const List<MapEntry<String, String>> _tabs =
      <MapEntry<String, String>>[
        MapEntry<String, String>('trending', 'Trending'),
        MapEntry<String, String>('movies', 'Movies'),
        MapEntry<String, String>('webSeries', 'Web Series'),
        MapEntry<String, String>('anime', 'Anime'),
        MapEntry<String, String>('free', 'Free'),
      ];

  static const Map<String, List<String>>
  _sectionOrders = <String, List<String>>{
    'trending': <String>[
      'trending',
      'movies',
      'anime',
      'webSeries',
      'popularAnime',
    ],
    'movies': <String>['movies', 'freeMovies', 'adventure', 'classicMovies'],
    'webSeries': <String>['webSeries', 'classicSeries', 'documentarySeries'],
    'anime': <String>['anime', 'popularAnime'],
    'free': <String>['freeMovies', 'classicMovies', 'documentarySeries'],
  };

  static const Map<String, String> _sectionTitles = <String, String>{
    'trending': 'Trending Now',
    'movies': 'Movies For You',
    'webSeries': 'Web Series',
    'anime': 'Anime',
    'freeMovies': 'Free Movies',
    'classicMovies': 'Classic Movies',
    'adventure': 'Adventure & Comedy',
    'classicSeries': 'Classic Series',
    'documentarySeries': 'Documentaries',
    'popularAnime': 'Popular Anime',
  };

  static const Map<String, String> _sectionSubtitles = <String, String>{
    'trending': 'Most popular right now',
    'movies': 'Pick something and press play',
    'webSeries': 'Binge-worthy episodic content',
    'anime': 'From AniList public metadata',
    'freeMovies': 'Free public Archive.org media',
    'classicMovies': 'Old-school favourites',
    'adventure': 'Action, adventure and comedy',
    'classicSeries': 'Classic television',
    'documentarySeries': 'Learn something new',
    'popularAnime': 'All-time anime favourites',
  };

  final CatalogRepository _catalog = CatalogRepository();
  final StreamRepository _streams = StreamRepository();
  late Future<Map<String, List<MediaItem>>> _homeFuture;
  String _selectedCategory = 'trending';
  int _selectedIndex = 0;

  @override
  void initState() {
    super.initState();
    _homeFuture = _catalog.loadHome();
  }

  Future<void> _refresh() async {
    final future = _catalog.loadHome();
    setState(() => _homeFuture = future);
    try {
      await future;
    } catch (_) {
      // The repository already falls back to public APIs.
    }
  }

  void _openDetail(MediaItem item) {
    context.go('/detail/${item.type}/${Uri.encodeComponent(item.id)}');
  }

  Future<void> _playItem(MediaItem item) async {
    try {
      final stream = await _streams.resolve(
        provider: item.provider,
        id: item.id,
        type: item.type,
        title: item.title,
        episode: '1',
      );
      if (!stream.isValid) {
        throw const FormatException('No playable stream URL returned.');
      }
      if (!mounted) return;
      context.push(
        '/player?url=${Uri.encodeComponent(stream.url)}'
        '&title=${Uri.encodeComponent(item.title)}'
        '&referer=${Uri.encodeComponent(stream.referer)}',
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not play this title: $error')),
      );
    }
  }

  List<MediaItem> _heroItems(Map<String, List<MediaItem>> sections) {
    final order =
        _sectionOrders[_selectedCategory] ?? _sectionOrders['trending']!;
    for (final key in order) {
      final items = sections[key];
      if (items != null && items.isNotEmpty) return items.take(6).toList();
    }
    return kSampleMedia;
  }

  List<MapEntry<String, List<MediaItem>>> _rails(
    Map<String, List<MediaItem>> sections,
  ) {
    final order =
        _sectionOrders[_selectedCategory] ?? _sectionOrders['trending']!;
    final rails = <MapEntry<String, List<MediaItem>>>[];
    for (final key in order) {
      final items = sections[key];
      if (items != null && items.isNotEmpty) {
        rails.add(MapEntry<String, List<MediaItem>>(key, items));
      }
    }
    return rails;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                gradient: const LinearGradient(
                  colors: <Color>[AppColors.primary, AppColors.primaryDeep],
                ),
              ),
              child: const Icon(Icons.play_arrow_rounded, size: 20),
            ),
            const SizedBox(width: 10),
            const Text(
              'Flix4U',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 21),
            ),
          ],
        ),
        actions: <Widget>[
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _refresh,
            tooltip: 'Refresh',
          ),
          IconButton(
            icon: const Icon(Icons.search_rounded),
            onPressed: () => context.go('/search'),
            tooltip: 'Search',
          ),
        ],
      ),
      body: FutureBuilder<Map<String, List<MediaItem>>>(
        future: _homeFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final sections = (snapshot.hasData && snapshot.data!.isNotEmpty)
              ? snapshot.data!
              : <String, List<MediaItem>>{
                  'trending': kSampleMedia,
                  'movies': kSampleMedia,
                  'webSeries': kSampleMedia,
                  'anime': kSampleMedia,
                };
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: _refresh,
            child: CustomScrollView(
              slivers: <Widget>[
                SliverToBoxAdapter(child: _categoryTabs()),
                SliverToBoxAdapter(
                  child: HeroCarousel(
                    items: _heroItems(sections),
                    onPlay: _playItem,
                    onDetails: _openDetail,
                  ),
                ),
                ..._rails(sections).map(
                  (entry) => SliverToBoxAdapter(
                    child: SectionRail(
                      title: _sectionTitles[entry.key] ?? entry.key,
                      subtitle: _sectionSubtitles[entry.key],
                      items: entry.value,
                      onSeeAll: () => context.go('/category/${entry.key}'),
                      onTap: _openDetail,
                    ),
                  ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 28)),
              ],
            ),
          );
        },
      ),
      bottomNavigationBar: AppBottomNav(selectedIndex: _selectedIndex),
    );
  }

  Widget _categoryTabs() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 12),
      child: SizedBox(
        height: 36,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: _tabs.length,
          separatorBuilder: (_, __) => const SizedBox(width: 8),
          itemBuilder: (context, index) {
            final entry = _tabs[index];
            final selected = entry.key == _selectedCategory;
            return ChoiceChip(
              label: Text(entry.value),
              selected: selected,
              onSelected: (_) => setState(() => _selectedCategory = entry.key),
              labelStyle: TextStyle(
                color: selected ? Colors.white : Colors.white70,
                fontWeight: FontWeight.w700,
              ),
              selectedColor: AppColors.primary,
              backgroundColor: AppColors.surfaceAlt,
              side: BorderSide.none,
            );
          },
        ),
      ),
    );
  }
}
