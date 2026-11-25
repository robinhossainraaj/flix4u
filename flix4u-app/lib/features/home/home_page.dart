import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../../core/playback/play_media.dart';
import '../../data/models/media_item.dart';
import '../../data/repositories/catalog_repository.dart';
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
        MapEntry<String, String>('webSeries', 'TV Series'),
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
    'trending': 'Trending now',
    'movies': 'Movies for you',
    'webSeries': 'TV series',
    'anime': 'Anime',
    'freeMovies': 'Free movies',
    'classicMovies': 'Classic movies',
    'adventure': 'Adventure & comedy',
    'classicSeries': 'Classic series',
    'documentarySeries': 'Documentaries',
    'popularAnime': 'Popular anime',
  };

  final CatalogRepository _catalog = CatalogRepository();
  late Future<Map<String, List<MediaItem>>> _homeFuture;
  String _selectedCategory = 'trending';
  DateTime? _lastBackPressed;

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

  void _play(MediaItem item) {
    playMedia(context, item);
  }

  void _onBackInvoked(bool didPop, Object? result) {
    if (didPop) return;

    final now = DateTime.now();
    if (_lastBackPressed == null ||
        now.difference(_lastBackPressed!) > const Duration(seconds: 2)) {
      _lastBackPressed = now;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text('Press back again to exit Flix4U'),
            duration: Duration(seconds: 2),
          ),
        );
      return;
    }
    SystemNavigator.pop();
  }

  List<MediaItem> _continueWatching() {
    final value = Hive.box('library').get('continueWatching');
    if (value is! List) return const <MediaItem>[];
    final items = <MediaItem>[];
    for (final entry in value.take(12)) {
      try {
        final decoded = jsonDecode(entry.toString()) as Map<String, dynamic>;
        items.add(MediaItem.fromJson(decoded));
      } catch (_) {
        // ignore malformed local entries
      }
    }
    return items;
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
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: _onBackInvoked,
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: SafeArea(
          bottom: false,
          child: Column(
            children: <Widget>[
              _header(),
              _categoryTabs(),
              Expanded(
                child: FutureBuilder<Map<String, List<MediaItem>>>(
                  future: _homeFuture,
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const _HomeLoading();
                    }

                    final sections =
                        (snapshot.hasData && snapshot.data!.isNotEmpty)
                        ? snapshot.data!
                        : <String, List<MediaItem>>{
                            'trending': kSampleMedia,
                            'movies': kSampleMedia,
                            'webSeries': kSampleMedia,
                            'anime': kSampleMedia,
                          };

                    final continueItems = _continueWatching();

                    return RefreshIndicator(
                      color: AppColors.primary,
                      backgroundColor: AppColors.surface,
                      onRefresh: _refresh,
                      child: CustomScrollView(
                        physics: const AlwaysScrollableScrollPhysics(
                          parent: BouncingScrollPhysics(),
                        ),
                        slivers: <Widget>[
                          SliverToBoxAdapter(
                            child: HeroCarousel(
                              items: _heroItems(sections),
                              onPlay: _play,
                            ),
                          ),
                          if (continueItems.isNotEmpty)
                            SliverToBoxAdapter(
                              child: SectionRail(
                                title: 'Continue watching',
                                subtitle: 'Jump back in',
                                items: continueItems,
                                onTap: _play,
                              ),
                            ),
                          ..._rails(sections).map(
                            (entry) => SliverToBoxAdapter(
                              child: SectionRail(
                                title: _sectionTitles[entry.key] ?? entry.key,
                                items: entry.value,
                                onSeeAll: () =>
                                    context.push('/category/${entry.key}'),
                                onTap: _play,
                              ),
                            ),
                          ),
                          const SliverToBoxAdapter(child: SizedBox(height: 28)),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
        bottomNavigationBar: const AppBottomNav(selectedIndex: 0),
      ),
    );
  }

  Widget _header() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 10, 8),
      child: Row(
        children: <Widget>[
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: <Color>[AppColors.primary, AppColors.primaryDeep],
              ),
            ),
            child: const Icon(
              Icons.play_arrow_rounded,
              size: 23,
              color: AppColors.onPrimary,
            ),
          ),
          const SizedBox(width: 10),
          const Text(
            'Flix4U',
            style: TextStyle(
              color: AppColors.text,
              fontSize: 22,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: InkWell(
              onTap: () => context.go('/search'),
              borderRadius: BorderRadius.circular(22),
              child: Container(
                height: 42,
                padding: const EdgeInsets.symmetric(horizontal: 13),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: AppColors.surfaceAlt),
                ),
                child: const Row(
                  children: <Widget>[
                    Icon(
                      Icons.search_rounded,
                      size: 18,
                      color: AppColors.muted,
                    ),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Search movies, series, anime',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: AppColors.muted,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 2),
          IconButton(
            onPressed: () => context.go('/me'),
            tooltip: 'Profile',
            icon: const Icon(
              Icons.notifications_none_rounded,
              color: AppColors.text,
              size: 23,
            ),
          ),
        ],
      ),
    );
  }

  Widget _categoryTabs() {
    return Container(
      height: 48,
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.surfaceAlt)),
      ),
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        itemCount: _tabs.length,
        separatorBuilder: (_, __) => const SizedBox(width: 22),
        itemBuilder: (context, index) {
          final entry = _tabs[index];
          final selected = entry.key == _selectedCategory;
          return InkWell(
            onTap: () => setState(() => _selectedCategory = entry.key),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                Text(
                  entry.value,
                  style: TextStyle(
                    color: selected ? AppColors.text : AppColors.muted,
                    fontSize: 13.5,
                    fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  width: selected ? 22 : 0,
                  height: 3,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _HomeLoading extends StatelessWidget {
  const _HomeLoading();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          SizedBox(
            width: 26,
            height: 26,
            child: CircularProgressIndicator(strokeWidth: 2.5),
          ),
          SizedBox(height: 14),
          Text(
            'Loading your picks...',
            style: TextStyle(color: AppColors.muted, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
