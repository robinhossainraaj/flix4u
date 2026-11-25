import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../../data/models/media_item.dart';
import '../../widgets/media_card.dart';

class LibraryPage extends StatelessWidget {
  const LibraryPage({super.key});

  List<MediaItem> _items(String key) {
    final value = Hive.box('library').get(key);
    if (value is! List) return const <MediaItem>[];
    final items = <MediaItem>[];
    for (final entry in value) {
      try {
        final decoded = jsonDecode(entry.toString()) as Map<String, dynamic>;
        items.add(MediaItem.fromJson(decoded));
      } catch (_) {
        // ignore malformed local entries
      }
    }
    return items;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Library')),
      body: ValueListenableBuilder(
        valueListenable: Hive.box('library').listenable(
          keys: const <String>['favorites', 'watchlist', 'continueWatching'],
        ),
        builder: (context, _, __) {
          final sections = <String, List<MediaItem>>{
            'Continue Watching': _items('continueWatching'),
            'Favorites': _items('favorites'),
            'Watchlist': _items('watchlist'),
          };
          return ListView(
            children: sections.entries.map((entry) {
              final items = entry.value;
              if (items.isEmpty) return const SizedBox.shrink();
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Text(
                        entry.key,
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
            }).toList(),
          );
        },
      ),
    );
  }
}
