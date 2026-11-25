import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/media_item.dart';
import '../../data/repositories/catalog_repository.dart';
import '../../theme/app_theme.dart';
import '../../widgets/media_card.dart';

class CategoryPage extends StatefulWidget {
  const CategoryPage({super.key, required this.categoryKey});

  final String categoryKey;

  @override
  State<CategoryPage> createState() => _CategoryPageState();
}

class _CategoryInfo {
  const _CategoryInfo({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.keys,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final List<String> keys;
}

class _CategoryPageState extends State<CategoryPage> {
  static const Map<String, _CategoryInfo> _definitions =
      <String, _CategoryInfo>{
        'trending': _CategoryInfo(
          title: 'Trending Now',
          subtitle: 'What everyone is watching right now',
          icon: Icons.local_fire_department_rounded,
          keys: <String>['trending', 'movies', 'anime', 'webSeries'],
        ),
        'movies': _CategoryInfo(
          title: 'Movies',
          subtitle: 'Free public movies and films',
          icon: Icons.movie_rounded,
          keys: <String>['movies', 'freeMovies', 'classicMovies', 'adventure'],
        ),
        'webSeries': _CategoryInfo(
          title: 'Web Series',
          subtitle: 'Episodic shows and series',
          icon: Icons.tv_rounded,
          keys: <String>['webSeries', 'classicSeries', 'documentarySeries'],
        ),
        'anime': _CategoryInfo(
          title: 'Anime',
          subtitle: 'Trending and popular anime from AniList',
          icon: Icons.animation_rounded,
          keys: <String>['anime', 'popularAnime', 'trending'],
        ),
        'free': _CategoryInfo(
          title: 'Free Movies',
          subtitle: 'No account, no payment, just press play',
          icon: Icons.card_giftcard_rounded,
          keys: <String>['freeMovies', 'classicMovies', 'movies'],
        ),
        'freeMovies': _CategoryInfo(
          title: 'Free Movies',
          subtitle: 'No account, no payment, just press play',
          icon: Icons.card_giftcard_rounded,
          keys: <String>['freeMovies', 'movies'],
        ),
        'classicMovies': _CategoryInfo(
          title: 'Classic Movies',
          subtitle: 'Old-school films and vintage cinema',
          icon: Icons.theater_comedy_outlined,
          keys: <String>['classicMovies', 'movies'],
        ),
        'adventure': _CategoryInfo(
          title: 'Adventure & Comedy',
          subtitle: 'Action, adventure and comedy picks',
          icon: Icons.explore_outlined,
          keys: <String>['adventure', 'movies'],
        ),
        'classicSeries': _CategoryInfo(
          title: 'Classic Series',
          subtitle: 'Classic television and episodic shows',
          icon: Icons.tv_rounded,
          keys: <String>['classicSeries', 'webSeries'],
        ),
        'documentarySeries': _CategoryInfo(
          title: 'Documentaries',
          subtitle: 'Real stories and educational series',
          icon: Icons.school_outlined,
          keys: <String>['documentarySeries', 'webSeries'],
        ),
        'popularAnime': _CategoryInfo(
          title: 'Popular Anime',
          subtitle: 'All-time favourites from AniList',
          icon: Icons.star_border_rounded,
          keys: <String>['popularAnime', 'anime'],
        ),
      };

  final CatalogRepository _repository = CatalogRepository();
  late Future<Map<String, List<MediaItem>>> _future;
  String? _genre;
  String _sort = 'popular';
  String _query = '';

  @override
  void initState() {
    super.initState();
    _future = _repository.loadHome();
  }

  _CategoryInfo get _info =>
      _definitions[widget.categoryKey] ?? _definitions['movies']!;

  List<MediaItem> _sourceItems(Map<String, List<MediaItem>> sections) {
    final seen = <String>{};
    final items = <MediaItem>[];
    for (final key in _info.keys) {
      for (final item in sections[key] ?? const <MediaItem>[]) {
        if (seen.add(item.id)) items.add(item);
      }
    }
    return items;
  }

  List<String> _genres(List<MediaItem> items) {
    final values = <String>{};
    for (final item in items) {
      values.addAll(item.genres.take(4));
    }
    final list = values.toList()..sort();
    return list.take(14).toList();
  }

  List<MediaItem> _filtered(List<MediaItem> items) {
    final query = _query.trim().toLowerCase();
    final result = items.where((item) {
      final genreMatch = _genre == null || item.genres.contains(_genre);
      final queryMatch =
          query.isEmpty ||
          item.title.toLowerCase().contains(query) ||
          item.description.toLowerCase().contains(query);
      return genreMatch && queryMatch;
    }).toList();

    switch (_sort) {
      case 'title':
        result.sort((a, b) => a.title.compareTo(b.title));
        break;
      case 'year':
        result.sort((a, b) => (b.year ?? 0).compareTo(a.year ?? 0));
        break;
      case 'rating':
        result.sort((a, b) => (b.rating ?? 0).compareTo(a.rating ?? 0));
        break;
      default:
        break;
    }
    return result;
  }

  void _openDetail(MediaItem item) {
    context.go('/detail/${item.type}/${Uri.encodeComponent(item.id)}');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FutureBuilder<Map<String, List<MediaItem>>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || !snapshot.hasData) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'Could not load ${_info.title}: ${snapshot.error}',
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }
          final all = _sourceItems(snapshot.data!);
          final genres = _genres(all);
          final items = _filtered(all);
          return CustomScrollView(
            slivers: <Widget>[
              SliverAppBar(
                expandedHeight: 250,
                pinned: true,
                flexibleSpace: FlexibleSpaceBar(
                  title: Text(
                    _info.title,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  titlePadding: const EdgeInsets.only(left: 20, bottom: 18),
                  background: _banner(all),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Row(
                        children: <Widget>[
                          Icon(_info.icon, size: 18, color: AppColors.primary),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _info.subtitle,
                              style: const TextStyle(
                                color: AppColors.muted,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        onChanged: (value) => setState(() => _query = value),
                        decoration: const InputDecoration(
                          hintText: 'Filter this category',
                          prefixIcon: Icon(Icons.filter_list_rounded),
                        ),
                      ),
                      const SizedBox(height: 14),
                      SizedBox(
                        height: 38,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: genres.length + 1,
                          separatorBuilder: (_, __) => const SizedBox(width: 8),
                          itemBuilder: (context, index) {
                            if (index == 0) {
                              return FilterChip(
                                label: const Text('All'),
                                selected: _genre == null,
                                onSelected: (_) =>
                                    setState(() => _genre = null),
                              );
                            }
                            final genre = genres[index - 1];
                            return FilterChip(
                              label: Text(genre),
                              selected: _genre == genre,
                              onSelected: (_) => setState(
                                () => _genre = _genre == genre ? null : genre,
                              ),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: <Widget>[
                          Text(
                            '${items.length} titles',
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 12,
                            ),
                          ),
                          const Spacer(),
                          DropdownButton<String>(
                            value: _sort,
                            dropdownColor: AppColors.surfaceAlt,
                            style: const TextStyle(color: Colors.white),
                            underline: const SizedBox.shrink(),
                            items: const <DropdownMenuItem<String>>[
                              DropdownMenuItem(
                                value: 'popular',
                                child: Text('Popular'),
                              ),
                              DropdownMenuItem(
                                value: 'title',
                                child: Text('A - Z'),
                              ),
                              DropdownMenuItem(
                                value: 'year',
                                child: Text('Newest'),
                              ),
                              DropdownMenuItem(
                                value: 'rating',
                                child: Text('Rating'),
                              ),
                            ],
                            onChanged: (value) =>
                                setState(() => _sort = value ?? 'popular'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              if (items.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: <Widget>[
                          Icon(_info.icon, size: 64, color: Colors.white24),
                          const SizedBox(height: 12),
                          const Text(
                            'Nothing matched this filter.',
                            style: TextStyle(color: AppColors.muted),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                  sliver: SliverGrid(
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 3,
                          crossAxisSpacing: 10,
                          mainAxisSpacing: 14,
                          childAspectRatio: 0.56,
                        ),
                    delegate: SliverChildBuilderDelegate((context, index) {
                      final item = items[index];
                      return MediaCard(
                        item: item,
                        width: 108,
                        imageHeight: 150,
                        onTap: () => _openDetail(item),
                      );
                    }, childCount: items.length),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _banner(List<MediaItem> items) {
    final image = items.isEmpty
        ? ''
        : (items.first.backdrop.isNotEmpty
              ? items.first.backdrop
              : items.first.poster);
    return Stack(
      fit: StackFit.expand,
      children: <Widget>[
        if (image.isNotEmpty)
          CachedNetworkImage(
            imageUrl: image,
            fit: BoxFit.cover,
            placeholder: (_, __) => const _BannerGradient(),
            errorWidget: (_, __, ___) => const _BannerGradient(),
          )
        else
          const _BannerGradient(),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: <Color>[
                Color(0x6608080D),
                Color(0xCC08090D),
                AppColors.background,
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _BannerGradient extends StatelessWidget {
  const _BannerGradient();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: <Color>[Color(0xFF4C1D95), Color(0xFF0F172A)],
        ),
      ),
    );
  }
}
