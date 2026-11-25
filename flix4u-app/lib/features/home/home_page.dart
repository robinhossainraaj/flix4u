import 'dart:convert';

import 'package:cached_network_image/cached_network_image.dart';
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
import '../../widgets/brand_mark.dart';
import '../../widgets/hero_carousel.dart';
import '../../widgets/section_rail.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  static const List<String> _channels = <String>[
    'Channel',
    'Midnight 18',
    'Anime',
    'ShortTV',
    'Kids',
    'Edu',
  ];

  static const Map<String, List<String>> _channelSections =
      <String, List<String>>{
        'Channel': <String>[
          'trending',
          'movies',
          'anime',
          'webSeries',
          'popularAnime',
        ],
        'Midnight 18': <String>[
          'movies',
          'adventure',
          'freeMovies',
          'classicMovies',
        ],
        'Anime': <String>['anime', 'popularAnime', 'trending'],
        'ShortTV': <String>['shorts', 'trending', 'movies'],
        'Kids': <String>['freeMovies', 'classicMovies', 'movies'],
        'Edu': <String>[
          'documentarySeries',
          'classicSeries',
          'webSeries',
        ],
      };

  static const List<MapEntry<String, String>> _categories =
      <MapEntry<String, String>>[
        MapEntry<String, String>('all', 'All'),
        MapEntry<String, String>('anime', 'Anime'),
        MapEntry<String, String>('usAnimation', 'US Animation'),
      ];

  final CatalogRepository _catalog = CatalogRepository();
  late Future<Map<String, List<MediaItem>>> _homeFuture;
  String _channel = 'Channel';
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
      // Repository falls back to public APIs.
    }
  }

  void _play(MediaItem item) => playMedia(context, item);

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
        items.add(
          MediaItem.fromJson(jsonDecode(entry.toString()) as Map<String, dynamic>),
        );
      } catch (_) {
        // ignore malformed local entries
      }
    }
    return items;
  }

  List<String> get _sectionOrder =>
      _channelSections[_channel] ?? _channelSections['Channel']!;

  List<MediaItem> _itemsFor(
    Map<String, List<MediaItem>> sections,
    String key,
  ) {
    var items = sections[key] ?? const <MediaItem>[];
    if (_channel == 'Kids') {
      items = items
          .where(
            (item) => item.genres.any(
              (genre) => const <String>[
                'Animation',
                'Family',
                'Kids',
                'Children',
                'Comedy',
              ].any(
                (allowed) => genre.toLowerCase().contains(allowed.toLowerCase()),
              ),
            ),
          )
          .toList();
    }
    return items;
  }

  List<MediaItem> _heroItems(Map<String, List<MediaItem>> sections) {
    for (final key in _sectionOrder) {
      final items = _itemsFor(sections, key);
      if (items.isNotEmpty) return items.take(6).toList();
    }
    return kSampleMedia.take(6).toList();
  }

  List<MediaItem> _railItems(
    Map<String, List<MediaItem>> sections,
    int offset,
  ) {
    final order = _sectionOrder;
    for (var i = offset; i < order.length; i++) {
      final items = _itemsFor(sections, order[i]);
      if (items.length >= 3) return items;
    }
    for (final key in order) {
      final items = _itemsFor(sections, key);
      if (items.isNotEmpty) return items;
    }
    return kSampleMedia;
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
              _topArea(),
              Expanded(
                child: FutureBuilder<Map<String, List<MediaItem>>>(
                  future: _homeFuture,
                  builder: (context, snapshot) {
                    final sections =
                        (snapshot.hasData && snapshot.data!.isNotEmpty)
                        ? snapshot.data!
                        : <String, List<MediaItem>>{
                            'trending': kSampleMedia,
                            'movies': kSampleMedia,
                            'anime': kSampleMedia,
                            'webSeries': kSampleMedia,
                            'shorts': kSampleMedia,
                          };
                    final continueItems = _continueWatching();
                    final firstRail = _railItems(sections, 0);
                    final secondRail = _railItems(sections, 1);

                    return RefreshIndicator(
                      color: AppColors.accent,
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
                              onInfo: (item) => context.push(
                                '/detail/${item.type}/${Uri.encodeComponent(item.id)}',
                              ),
                            ),
                          ),
                          SliverToBoxAdapter(
                            child: _featureCards(firstRail),
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
                          SliverToBoxAdapter(child: _categoryRow()),
                          SliverToBoxAdapter(
                            child: SectionRail(
                              title: 'Trending Now',
                              subtitle: 'Popular on Flix4U ${_channelLabel()}',
                              items: firstRail,
                              onSeeAll: () => context.push(
                                '/category/${_sectionOrder.first}?channel=${Uri.encodeComponent(_channel)}',
                              ),
                              onTap: _play,
                            ),
                          ),
                          SliverToBoxAdapter(
                            child: SectionRail(
                              title: 'Trending Now',
                              subtitle: 'More to explore',
                              items: secondRail,
                              onSeeAll: () => context.push(
                                '/category/${_sectionOrder.last}?channel=${Uri.encodeComponent(_channel)}',
                              ),
                              onTap: _play,
                            ),
                          ),
                          const SliverToBoxAdapter(child: SizedBox(height: 24)),
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

  String _channelLabel() {
    if (_channel == 'Channel') return '';
    return '· $_channel';
  }

  Widget _topArea() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: <Color>[AppColors.step3, AppColors.step2, AppColors.background],
          stops: <double>[0, 0.62, 1],
        ),
      ),
      child: Column(
        children: <Widget>[_header(), _channelTabs()],
      ),
    );
  }

  Widget _header() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 10, 12, 6),
      child: Row(
        children: <Widget>[
          BrandMark(
            size: 34,
            onTap: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('You are already on Flix4U Home.')),
            ),
          ),
          const SizedBox(width: 9),
          Expanded(
            child: InkWell(
              onTap: () => context.go('/search'),
              borderRadius: BorderRadius.circular(8),
              child: Container(
                height: 39,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: AppColors.step4.withOpacity(0.20),
                  borderRadius: BorderRadius.circular(7),
                  border: Border.all(color: AppColors.accentSoft.withOpacity(0.42)),
                ),
                child: Row(
                  children: <Widget>[
                    const Icon(
                      Icons.search_rounded,
                      size: 18,
                      color: AppColors.step7,
                    ),
                    const SizedBox(width: 11),
                    const Expanded(
                      child: Text(
                        'The Family Business',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: AppColors.text,
                          fontSize: 14.5,
                        ),
                      ),
                    ),
                    Text(
                      'Search',
                      style: const TextStyle(
                        color: AppColors.step6,
                        fontSize: 14.5,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _channelTabs() {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 14),
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        itemCount: _channels.length,
        separatorBuilder: (_, __) => const SizedBox(width: 20),
        itemBuilder: (context, index) {
          final channel = _channels[index];
          final selected = channel == _channel;
          return InkWell(
            onTap: () => setState(() => _channel = channel),
            child: Row(
              children: <Widget>[
                Text(
                  channel,
                  style: TextStyle(
                    color: selected
                        ? AppColors.text
                        : AppColors.muted.withOpacity(0.82),
                    fontSize: selected ? 16 : 13.5,
                    fontWeight: selected ? FontWeight.w900 : FontWeight.w600,
                  ),
                ),
                if (channel == 'Midnight 18') ...<Widget>[
                  const SizedBox(width: 3),
                  Container(
                    width: 16,
                    height: 16,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0x44F27171),
                      border: Border.all(color: const Color(0xFFF27171), width: 1.3),
                    ),
                    alignment: Alignment.center,
                    child: const Text(
                      '18',
                      style: TextStyle(
                        color: AppColors.text,
                        fontSize: 7,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _featureCards(List<MediaItem> items) {
    final cards = items.take(4).toList();
    if (cards.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      height: 63,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 13),
        scrollDirection: Axis.horizontal,
        itemCount: cards.length,
        separatorBuilder: (_, __) => const SizedBox(width: 9),
        itemBuilder: (context, index) {
          final item = cards[index];
          return SizedBox(
            width: index.isEven ? 286 : 300,
            child: Material(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(10),
              child: InkWell(
                onTap: () => _play(item),
                borderRadius: BorderRadius.circular(10),
                child: Stack(
                  children: <Widget>[
                    Positioned(
                      left: 8,
                      top: 7,
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: SizedBox(
                          width: 43,
                          height: 53,
                          child: item.poster.isNotEmpty
                              ? CachedNetworkImage(
                                  imageUrl: item.poster,
                                  fit: BoxFit.cover,
                                  errorWidget: (_, __, ___) =>
                                      const _FeatureThumb(),
                                  placeholder: (_, __) => const _FeatureThumb(),
                                )
                              : const _FeatureThumb(),
                        ),
                      ),
                    ),
                    Positioned(
                      left: 58,
                      right: 46,
                      top: 8,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            '${item.title} [${item.languageLabel}]',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: AppColors.text,
                              fontSize: 13.5,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            'TV  |  ${item.year ?? '2026'}  |  ${item.genres.isEmpty ? item.type.toUpperCase() : item.genres.first}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 11.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Positioned(
                      right: 10,
                      top: 17,
                      child: Container(
                        width: 27,
                        height: 27,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: AppColors.brandGradient,
                        ),
                        child: const Icon(
                          Icons.play_arrow_rounded,
                          size: 18,
                          color: AppColors.step1,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _categoryRow() {
    final colors = <List<Color>>[
      const <Color>[AppColors.step3, AppColors.step2],
      const <Color>[AppColors.step4, AppColors.step3],
      const <Color>[AppColors.step5, AppColors.step4],
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        const Padding(
          padding: EdgeInsets.fromLTRB(13, 14, 13, 8),
          child: Text(
            'Categories',
            style: TextStyle(
              color: AppColors.text,
              fontSize: 17,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        SizedBox(
          height: 43,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 13),
            scrollDirection: Axis.horizontal,
            itemCount: _categories.length,
            separatorBuilder: (_, __) => const SizedBox(width: 9),
            itemBuilder: (context, index) {
              final entry = _categories[index];
              return InkWell(
                onTap: () => context.push(
                  '/category/${entry.key}?channel=${Uri.encodeComponent(_channel)}',
                ),
                borderRadius: BorderRadius.circular(6),
                child: Container(
                  width: index == 0 ? 48 : 124,
                  alignment: Alignment.centerLeft,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(6),
                    gradient: LinearGradient(colors: colors[index]),
                    border: Border.all(color: AppColors.accentSoft.withOpacity(0.30)),
                  ),
                  child: Text(
                    entry.value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.text,
                      fontSize: 14.5,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _FeatureThumb extends StatelessWidget {
  const _FeatureThumb();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(gradient: AppColors.cardGradient),
      child: const Icon(
        Icons.movie_rounded,
        color: AppColors.accentSoft,
        size: 20,
      ),
    );
  }
}
