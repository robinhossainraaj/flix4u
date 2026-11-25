import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/playback/play_media.dart';
import '../../data/models/media_item.dart';
import '../../data/repositories/catalog_repository.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_back_button.dart';
import '../../widgets/app_bottom_nav.dart';
import '../../widgets/brand_mark.dart';

class CategoryPage extends StatefulWidget {
  const CategoryPage({
    super.key,
    required this.categoryKey,
    this.channel,
  });

  final String categoryKey;
  final String? channel;

  @override
  State<CategoryPage> createState() => _CategoryPageState();
}

class _CategoryPageState extends State<CategoryPage> {
  static const List<String> _channels = <String>[
    'Education',
    'Music',
    'Arab',
    'Hindi',
    'Game',
    'FightZone',
  ];
  static const List<String> _subTabs = <String>[
    'Movie',
    'TV Series',
    'Anime',
  ];

  final CatalogRepository _repository = CatalogRepository();
  late Future<Map<String, List<MediaItem>>> _future;

  late String _channel;
  late String _subTab;
  String? _genre;
  String? _country;
  int? _year;
  String _sort = 'popular';

  @override
  void initState() {
    super.initState();
    _channel = _channels.contains(widget.channel) ? widget.channel! : 'Hindi';
    _subTab = _initialSubTab();
    _future = _repository.loadHome();
  }

  String _initialSubTab() {
    final key = widget.categoryKey.toLowerCase();
    if (key.contains('anime')) return 'Anime';
    if (key.contains('series') || key.contains('tv')) return 'TV Series';
    if (key.contains('music')) return 'Movie';
    return 'Movie';
  }

  List<String> get _baseKeys {
    switch (_subTab) {
      case 'Anime':
        return const <String>['anime', 'popularAnime'];
      case 'TV Series':
        return const <String>[
          'webSeries',
          'classicSeries',
          'documentarySeries',
        ];
      default:
        return const <String>[
          'movies',
          'freeMovies',
          'classicMovies',
          'adventure',
        ];
    }
  }

  List<MediaItem> _sourceItems(Map<String, List<MediaItem>> sections) {
    final keys = <String>[..._baseKeys];
    switch (_channel) {
      case 'Education':
        keys.insert(0, 'documentarySeries');
        break;
      case 'Music':
        keys.insert(0, 'music');
        break;
      case 'Game':
        keys.insert(0, 'adventure');
        break;
      case 'FightZone':
        keys.insert(0, 'adventure');
        keys.insert(1, 'movies');
        break;
    }
    final seen = <String>{};
    final items = <MediaItem>[];
    for (final key in keys) {
      for (final item in sections[key] ?? const <MediaItem>[]) {
        if (seen.add(item.id)) items.add(item);
      }
    }
    return items.where(_channelMatches).toList();
  }

  bool _channelMatches(MediaItem item) {
    final text =
        '${item.title} ${item.description} ${item.country ?? ''} ${item.language ?? ''} ${item.genres.join(' ')}'
            .toLowerCase();
    switch (_channel) {
      case 'Arab':
        return const <String>[
          'arabic',
          ' arab',
          'egypt',
          'uae',
          'saudi',
          'lebanon',
          'morocco',
        ].any(text.contains);
      case 'Hindi':
        return const <String>['hindi', 'india', 'bollywood'].any(text.contains) ||
            item.languageLabel.toLowerCase() == 'hindi';
      case 'Game':
        return const <String>['game', 'action', 'adventure', 'fantasy']
            .any(text.contains);
      case 'FightZone':
        return const <String>['fight', 'action', 'martial', 'boxing', 'war']
            .any(text.contains);
      case 'Education':
        return const <String>[
          'documentary',
          'education',
          'science',
          'history',
          'learn',
        ].any(text.contains);
      case 'Music':
        return const <String>['music', 'musical', 'concert', 'song']
            .any(text.contains);
      default:
        return true;
    }
  }

  List<MediaItem> _filter(List<MediaItem> items) {
    final result = items.where((item) {
      if (_genre != null && !item.genres.contains(_genre)) return false;
      if (_country != null && item.country != _country) return false;
      if (_year != null && item.year != _year) return false;
      return true;
    }).toList();
    switch (_sort) {
      case 'title':
        result.sort((a, b) => a.title.compareTo(b.title));
        break;
      case 'newest':
        result.sort((a, b) => (b.year ?? 0).compareTo(a.year ?? 0));
        break;
      case 'rating':
        result.sort((a, b) => (b.rating ?? 0).compareTo(a.rating ?? 0));
        break;
    }
    return result;
  }

  List<String> _options(List<MediaItem> items, String field) {
    final values = <String>{};
    for (final item in items) {
      if (field == 'genre') values.addAll(item.genres.take(4));
      if (field == 'country' &&
          item.country != null &&
          item.country!.isNotEmpty) {
        values.add(item.country!);
      }
    }
    final list = values.toList()..sort();
    return list.take(18).toList();
  }

  List<int> _years(List<MediaItem> items) {
    final years = items
        .where((item) => item.year != null)
        .map((item) => item.year!)
        .toSet()
        .toList()
      ..sort((a, b) => b.compareTo(a));
    return years.take(16).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: <Widget>[
            _header(),
            _channelTabs(),
            _subTabsRow(),
            Expanded(
              child: FutureBuilder<Map<String, List<MediaItem>>>(
                future: _future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(
                      child: CircularProgressIndicator(color: AppColors.accent),
                    );
                  }
                  final sections =
                      snapshot.data ?? const <String, List<MediaItem>>{};
                  final all = _sourceItems(sections);
                  final items = _filter(all);
                  return RefreshIndicator(
                    color: AppColors.accent,
                    backgroundColor: AppColors.surface,
                    onRefresh: () async {
                      final future = _repository.loadHome();
                      setState(() => _future = future);
                      await future;
                    },
                    child: CustomScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      slivers: <Widget>[
                        SliverToBoxAdapter(
                          child: _filterPills(
                            genres: _options(all, 'genre'),
                            countries: _options(all, 'country'),
                            years: _years(all),
                          ),
                        ),
                        if (items.isEmpty)
                          SliverFillRemaining(
                            hasScrollBody: false,
                            child: Center(
                              child: Padding(
                                padding: const EdgeInsets.all(28),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: <Widget>[
                                    const Icon(
                                      Icons.filter_alt_off_rounded,
                                      size: 48,
                                      color: AppColors.muted,
                                    ),
                                    const SizedBox(height: 10),
                                    const Text(
                                      'No titles match these filters.',
                                      style: TextStyle(color: AppColors.muted),
                                    ),
                                    const SizedBox(height: 12),
                                    OutlinedButton(
                                      onPressed: _resetFilters,
                                      child: const Text('Reset filters'),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          )
                        else
                          SliverPadding(
                            padding: const EdgeInsets.fromLTRB(13, 8, 13, 24),
                            sliver: SliverGrid(
                              gridDelegate:
                                  const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 3,
                                crossAxisSpacing: 8,
                                mainAxisSpacing: 14,
                                childAspectRatio: 0.62,
                              ),
                              delegate: SliverChildBuilderDelegate(
                                (context, index) =>
                                    _gridCard(items[index]),
                                childCount: items.length,
                              ),
                            ),
                          ),
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
    );
  }

  Widget _header() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(10, 10, 12, 4),
      child: Row(
        children: <Widget>[
          const AppBackButton(fallback: '/'),
          BrandMark(size: 32),
          const SizedBox(width: 9),
          Expanded(
            child: InkWell(
              onTap: () => context.go('/search'),
              child: Container(
                height: 39,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: AppColors.step3.withOpacity(0.45),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: AppColors.step4.withOpacity(0.45)),
                ),
                child: const Row(
                  children: <Widget>[
                    Icon(
                      Icons.search_rounded,
                      size: 18,
                      color: AppColors.text,
                    ),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Search titles',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: AppColors.text, fontSize: 14),
                      ),
                    ),
                    Text(
                      'Search',
                      style: TextStyle(
                        color: AppColors.step6,
                        fontSize: 14,
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
    return Container(
      height: 38,
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.step3, width: 0.6)),
      ),
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 13),
        scrollDirection: Axis.horizontal,
        itemCount: _channels.length,
        separatorBuilder: (_, __) => const SizedBox(width: 18),
        itemBuilder: (context, index) {
          final channel = _channels[index];
          final selected = channel == _channel;
          return InkWell(
            onTap: () => setState(() => _channel = channel),
            child: Center(
              child: Text(
                channel,
                style: TextStyle(
                  color: selected ? AppColors.text : AppColors.muted,
                  fontSize: selected ? 16 : 14,
                  fontWeight: selected ? FontWeight.w900 : FontWeight.w600,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _subTabsRow() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: _subTabs.map((tab) {
          final selected = tab == _subTab;
          return Padding(
            padding: const EdgeInsets.only(right: 28),
            child: InkWell(
              onTap: () => setState(() => _subTab = tab),
              child: Text(
                tab,
                style: TextStyle(
                  color: selected ? AppColors.text : AppColors.muted,
                  fontSize: selected ? 15.5 : 14.5,
                  fontWeight: selected ? FontWeight.w900 : FontWeight.w500,
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _filterPills({
    required List<String> genres,
    required List<String> countries,
    required List<int> years,
  }) {
    return Column(
      children: <Widget>[
        const Divider(height: 1, color: AppColors.step3),
        Padding(
          padding: const EdgeInsets.fromLTRB(13, 10, 13, 0),
          child: Row(
            children: <Widget>[
              _pill(
                label: _genre ?? 'Genre',
                active: _genre != null,
                onTap: () => _showOptions(
                  title: 'Genre',
                  options: genres,
                  selected: _genre,
                  onSelected: (value) =>
                      setState(() => _genre = value == _genre ? null : value),
                ),
              ),
              const SizedBox(width: 8),
              _pill(
                label: _country ?? 'Country',
                active: _country != null,
                onTap: () => _showOptions(
                  title: 'Country',
                  options: countries,
                  selected: _country,
                  onSelected: (value) =>
                      setState(() => _country = value == _country ? null : value),
                ),
              ),
              const SizedBox(width: 8),
              _pill(
                label: _year?.toString() ?? 'Year',
                active: _year != null,
                onTap: () => _showOptions(
                  title: 'Year',
                  options: years.map((e) => e.toString()).toList(),
                  selected: _year?.toString(),
                  onSelected: (value) => setState(
                    () => _year = value == _year?.toString()
                        ? null
                        : int.tryParse(value),
                  ),
                ),
              ),
              const Spacer(),
              IconButton(
                onPressed: _showFilterSheet,
                tooltip: 'More filters',
                icon: const Icon(Icons.tune_rounded, color: AppColors.accentSoft),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _pill({
    required String label,
    required bool active,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(15),
      child: Container(
        height: 30,
        padding: const EdgeInsets.symmetric(horizontal: 11),
        decoration: BoxDecoration(
          color: active ? AppColors.accent : AppColors.step3.withOpacity(0.40),
          borderRadius: BorderRadius.circular(15),
          border: Border.all(
            color: active ? AppColors.accentSoft : AppColors.accentSoft.withOpacity(0.60),
          ),
        ),
        child: Row(
          children: <Widget>[
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: active ? AppColors.step1 : AppColors.text,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(width: 3),
            Icon(
              Icons.keyboard_arrow_down_rounded,
              size: 14,
              color: active ? AppColors.step1 : AppColors.text,
            ),
          ],
        ),
      ),
    );
  }

  void _showOptions({
    required String title,
    required List<String> options,
    required String? selected,
    required ValueChanged<String> onSelected,
  }) {
    if (options.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No $title values in this category yet.')),
      );
      return;
    }
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
              child: Row(
                children: <Widget>[
                  Text(
                    'Choose $title',
                    style: const TextStyle(
                      color: AppColors.text,
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    onPressed: () => Navigator.pop(sheetContext),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
            ),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: options.map((option) {
                    final active = option == selected;
                    return ChoiceChip(
                      label: Text(option),
                      selected: active,
                      onSelected: (_) {
                        onSelected(option);
                        Navigator.pop(sheetContext);
                      },
                      backgroundColor: AppColors.step3,
                      selectedColor: AppColors.accent,
                      labelStyle: TextStyle(
                        color: active ? AppColors.step1 : AppColors.text,
                        fontWeight: FontWeight.w700,
                      ),
                      side: BorderSide.none,
                    );
                  }).toList(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showFilterSheet() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              const Text(
                'Sort and reset',
                style: TextStyle(
                  color: AppColors.text,
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                children: <String>['popular', 'title', 'newest', 'rating']
                    .map(
                      (value) => ChoiceChip(
                        label: Text(value[0].toUpperCase() + value.substring(1)),
                        selected: _sort == value,
                        onSelected: (_) => setState(() => _sort = value),
                        backgroundColor: AppColors.step3,
                        selectedColor: AppColors.accent,
                        side: BorderSide.none,
                      ),
                    )
                    .toList(),
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () {
                    _resetFilters();
                    Navigator.pop(sheetContext);
                  },
                  icon: const Icon(Icons.restart_alt_rounded),
                  label: const Text('Reset all filters'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _resetFilters() {
    setState(() {
      _genre = null;
      _country = null;
      _year = null;
      _sort = 'popular';
    });
  }

  Widget _gridCard(MediaItem item) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => playMedia(context, item),
        borderRadius: BorderRadius.circular(6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(5),
                child: Stack(
                  fit: StackFit.expand,
                  children: <Widget>[
                    if (item.poster.isNotEmpty)
                      CachedNetworkImage(
                        imageUrl: item.poster,
                        fit: BoxFit.cover,
                        errorWidget: (_, __, ___) => const _GridFallback(),
                        placeholder: (_, __) => const _GridFallback(),
                      )
                    else
                      const _GridFallback(),
                    Positioned(
                      right: 0,
                      top: 0,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 7,
                          vertical: 3,
                        ),
                        color: const Color(0xCC04202E),
                        child: Text(
                          item.languageLabel,
                          style: const TextStyle(
                            color: AppColors.text,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                    if (item.rating != null)
                      Positioned(
                        right: 6,
                        bottom: 6,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 5,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xCC04202E),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            '★ ${item.rating!.toStringAsFixed(1)}',
                            style: const TextStyle(
                              color: AppColors.step6,
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              item.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.text,
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                height: 1.15,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              item.genres.take(2).join(', '),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppColors.muted, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}

class _GridFallback extends StatelessWidget {
  const _GridFallback();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(gradient: AppColors.cardGradient),
      child: const Center(
        child: Icon(Icons.movie_rounded, color: AppColors.accentSoft),
      ),
    );
  }
}
