import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../../core/playback/play_media.dart';
import '../../data/models/media_item.dart';
import '../../data/repositories/catalog_repository.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_bottom_nav.dart';
import '../../widgets/media_card.dart';
import '../../widgets/tab_pop_scope.dart';

class SearchPage extends StatefulWidget {
  const SearchPage({super.key});

  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  static const List<MapEntry<String, String>> _types =
      <MapEntry<String, String>>[
        MapEntry<String, String>('all', 'All'),
        MapEntry<String, String>('movie', 'Movies'),
        MapEntry<String, String>('tv', 'Web Series'),
        MapEntry<String, String>('anime', 'Anime'),
      ];

  final CatalogRepository _repository = CatalogRepository();
  final TextEditingController _controller = TextEditingController();
  String _type = 'all';
  Future<List<MediaItem>>? _future;

  Box get _settings => Hive.box('settings');

  List<String> get _recent {
    final value = _settings.get('recentSearches');
    if (value is! List) return const <String>[];
    return value.map((e) => e.toString()).take(8).toList();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _runSearch([String? preset]) {
    final query = (preset ?? _controller.text).trim();
    if (query.isEmpty) return;
    if (preset != null) _controller.text = preset;
    final recent = _recent.where((e) => e != query).toList();
    _settings.put(
      'recentSearches',
      <String>[query, ...recent].take(8).toList(),
    );
    setState(() {
      _future = _repository.search(query, type: _type);
    });
  }

  void _clearRecent() => _settings.delete('recentSearches');

  @override
  Widget build(BuildContext context) {
    return TabPopScope(
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: const Text(
            'Search',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 21),
          ),
        ),
        body: SafeArea(
          child: Column(
            children: <Widget>[
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: TextField(
                  controller: _controller,
                  onSubmitted: _runSearch,
                  decoration: const InputDecoration(
                    hintText: 'Search movies, series or anime',
                    prefixIcon: Icon(Icons.search_rounded),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                height: 38,
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  scrollDirection: Axis.horizontal,
                  itemCount: _types.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (context, index) {
                    final entry = _types[index];
                    final selected = entry.key == _type;
                    return ChoiceChip(
                      label: Text(entry.value),
                      selected: selected,
                      onSelected: (_) => setState(() => _type = entry.key),
                      selectedColor: AppColors.primary,
                      backgroundColor: AppColors.surface,
                      side: BorderSide.none,
                      labelStyle: TextStyle(
                        color: selected ? AppColors.onPrimary : AppColors.muted,
                        fontWeight: FontWeight.w700,
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: _future == null
                    ? _suggestions()
                    : FutureBuilder<List<MediaItem>>(
                        future: _future,
                        builder: (context, snapshot) {
                          if (snapshot.connectionState ==
                              ConnectionState.waiting) {
                            return const Center(
                              child: CircularProgressIndicator(),
                            );
                          }
                          if (snapshot.hasError) {
                            return Center(
                              child: Padding(
                                padding: const EdgeInsets.all(24),
                                child: Text(
                                  'Search failed: ${snapshot.error}',
                                  textAlign: TextAlign.center,
                                ),
                              ),
                            );
                          }
                          final items = snapshot.data ?? const <MediaItem>[];
                          if (items.isEmpty) {
                            return const Center(
                              child: Text('No results found.'),
                            );
                          }
                          return GridView.builder(
                            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                            gridDelegate:
                                const SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: 2,
                                  crossAxisSpacing: 12,
                                  mainAxisSpacing: 14,
                                  childAspectRatio: 1.02,
                                ),
                            itemCount: items.length,
                            itemBuilder: (context, index) {
                              final item = items[index];
                              return MediaCard(
                                item: item,
                                width: 164,
                                imageHeight: 96,
                                onTap: () => playMedia(context, item),
                              );
                            },
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
        bottomNavigationBar: const AppBottomNav(selectedIndex: 1),
      ),
    );
  }

  Widget _suggestions() {
    final recent = _recent;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            gradient: const LinearGradient(
              colors: <Color>[AppColors.surfaceAlt, AppColors.surface],
            ),
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Icon(Icons.search_rounded, color: Colors.white70, size: 32),
              SizedBox(height: 10),
              Text(
                'Find something to watch',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
              ),
              SizedBox(height: 4),
              Text(
                'Search public movies, web series and anime instantly.',
                style: TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        Row(
          children: <Widget>[
            const Text(
              'Recent searches',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
            const Spacer(),
            if (recent.isNotEmpty)
              TextButton(onPressed: _clearRecent, child: const Text('Clear')),
          ],
        ),
        if (recent.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 18),
            child: Text(
              'Your recent searches will appear here.',
              style: TextStyle(color: AppColors.muted),
            ),
          )
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: recent
                .map(
                  (term) => ActionChip(
                    avatar: const Icon(Icons.history, size: 16),
                    label: Text(term),
                    onPressed: () => _runSearch(term),
                  ),
                )
                .toList(),
          ),
        const SizedBox(height: 24),
        const Text(
          'Popular searches',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: <String>['classic', 'adventure', 'comedy', 'anime']
              .map(
                (term) => ActionChip(
                  avatar: const Icon(Icons.trending_up, size: 16),
                  label: Text(term),
                  onPressed: () => _runSearch(term),
                ),
              )
              .toList(),
        ),
      ],
    );
  }
}
