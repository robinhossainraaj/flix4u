import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/media_item.dart';
import '../../data/repositories/catalog_repository.dart';
import '../../data/sample_data.dart';
import '../../widgets/media_card.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final CatalogRepository _repository = CatalogRepository();
  late Future<Map<String, List<MediaItem>>> _homeFuture;
  int _selectedIndex = 0;

  @override
  void initState() {
    super.initState();
    _homeFuture = _repository.loadHome();
  }

  void _refresh() {
    setState(() {
      _homeFuture = _repository.loadHome();
    });
  }

  void _navigate(int index) {
    setState(() => _selectedIndex = index);
    switch (index) {
      case 0:
        context.go('/');
        break;
      case 1:
        context.go('/search');
        break;
      case 2:
        context.go('/library');
        break;
      case 3:
        context.go('/downloads');
        break;
      case 4:
        context.go('/settings');
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Flix4U'),
        actions: <Widget>[
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _refresh,
            tooltip: 'Refresh',
          ),
          IconButton(
            icon: const Icon(Icons.search),
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
          if (snapshot.hasError || !snapshot.hasData) {
            return _fallback(context, snapshot.error);
          }
          if (snapshot.data!.isEmpty) {
            return _fallback(context, 'Backend returned an empty catalog.');
          }
          return _sections(context, snapshot.data!);
        },
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: _navigate,
        destinations: const <NavigationDestination>[
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.search_outlined),
            selectedIcon: Icon(Icons.search),
            label: 'Search',
          ),
          NavigationDestination(
            icon: Icon(Icons.bookmark_border),
            selectedIcon: Icon(Icons.bookmark),
            label: 'Library',
          ),
          NavigationDestination(
            icon: Icon(Icons.download_outlined),
            selectedIcon: Icon(Icons.download),
            label: 'Downloads',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: 'Settings',
          ),
        ],
      ),
    );
  }

  Widget _fallback(BuildContext context, Object? error) {
    final sections = <String, List<MediaItem>>{
      'Featured': kSampleMedia,
      'Movies': kSampleMedia.where((e) => e.type == 'movie').toList(),
      'Web Series': kSampleMedia.where((e) => e.type == 'tv').toList(),
      'Anime': kSampleMedia.where((e) => e.type == 'anime').toList(),
    };
    return Column(
      children: <Widget>[
        Container(
          width: double.infinity,
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF2A1F10),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            'Backend catalog is not connected yet. Showing sample rows.\n$error',
            style: const TextStyle(color: Color(0xFFFFD08A)),
          ),
        ),
        Expanded(child: _sections(context, sections)),
      ],
    );
  }

  Widget _sections(
    BuildContext context,
    Map<String, List<MediaItem>> sections,
  ) {
    return ListView(
      children: sections.entries
          .map((entry) => _row(context, entry.key, entry.value))
          .toList(),
    );
  }

  Widget _row(BuildContext context, String title, List<MediaItem> items) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              title,
              style: Theme.of(context).textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 225,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              scrollDirection: Axis.horizontal,
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (context, index) {
                final item = items[index];
                return MediaCard(
                  item: item,
                  onTap: () => context.go(
                    '/detail/${item.type}/${Uri.encodeComponent(item.id)}',
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
