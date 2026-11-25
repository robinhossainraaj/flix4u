import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../../core/playback/play_media.dart';
import '../../data/models/media_item.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_back_button.dart';
import '../../widgets/section_rail.dart';

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
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: const AppBackButton(fallback: '/me'),
        title: const Text(
          'My Library',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 21),
        ),
      ),
      body: ValueListenableBuilder(
        valueListenable: Hive.box('library').listenable(
          keys: const <String>['favorites', 'watchlist', 'continueWatching'],
        ),
        builder: (context, _, __) {
          final sections = <String, List<MediaItem>>{
            'continueWatching': _items('continueWatching'),
            'favorites': _items('favorites'),
            'watchlist': _items('watchlist'),
          };
          final hasItems = sections.values.any((items) => items.isNotEmpty);
          return CustomScrollView(
            slivers: <Widget>[
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: AppColors.surfaceAlt),
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: <Color>[
                          AppColors.surfaceAlt,
                          AppColors.surface,
                        ],
                      ),
                    ),
                    child: const Row(
                      children: <Widget>[
                        Icon(
                          Icons.bookmark_rounded,
                          size: 38,
                          color: AppColors.primaryDeep,
                        ),
                        SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Text(
                                'Saved on this device',
                                style: TextStyle(
                                  color: AppColors.text,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 16,
                                ),
                              ),
                              SizedBox(height: 4),
                              Text(
                                'No account needed. Your list stays private.',
                                style: TextStyle(
                                  color: AppColors.muted,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              if (!hasItems)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: <Widget>[
                          const Icon(
                            Icons.bookmark_border,
                            size: 72,
                            color: AppColors.brand,
                          ),
                          const SizedBox(height: 14),
                          const Text(
                            'Your library is empty',
                            style: TextStyle(
                              color: AppColors.text,
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            'Play a title and it will appear in Continue watching.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: AppColors.muted),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              else ...<Widget>[
                SliverToBoxAdapter(
                  child: SectionRail(
                    title: 'Continue watching',
                    subtitle: 'Jump back in',
                    items: sections['continueWatching']!,
                    onTap: (item) => playMedia(context, item),
                  ),
                ),
                SliverToBoxAdapter(
                  child: SectionRail(
                    title: 'Favorites',
                    subtitle: 'Titles you loved',
                    items: sections['favorites']!,
                    onTap: (item) => playMedia(context, item),
                  ),
                ),
                SliverToBoxAdapter(
                  child: SectionRail(
                    title: 'Watchlist',
                    subtitle: 'Plan your next watch',
                    items: sections['watchlist']!,
                    onTap: (item) => playMedia(context, item),
                  ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 28)),
              ],
            ],
          );
        },
      ),
    );
  }
}
