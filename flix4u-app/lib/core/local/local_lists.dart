import 'dart:convert';

import 'package:hive_flutter/hive_flutter.dart';

import '../../data/models/media_item.dart';

/// Guest-only local lists and comments. Nothing here leaves the device.
class LocalLists {
  LocalLists._();

  static const String favorites = 'favorites';
  static const String watchlist = 'watchlist';

  static List<MediaItem> items(String key) {
    final value = Hive.box('library').get(key);
    if (value is! List) return const <MediaItem>[];
    final result = <MediaItem>[];
    for (final entry in value) {
      try {
        result.add(
          MediaItem.fromJson(jsonDecode(entry.toString()) as Map<String, dynamic>),
        );
      } catch (_) {
        // ignore malformed local entries
      }
    }
    return result;
  }

  static bool contains(String key, String id) {
    for (final item in items(key)) {
      if (item.id == id) return true;
    }
    return false;
  }

  static Future<bool> toggle(String key, MediaItem item) async {
    final current = items(key);
    final existing = current.where((entry) => entry.id == item.id).toList();
    if (existing.isNotEmpty) {
      await Hive.box('library').put(
        key,
        current
            .where((entry) => entry.id != item.id)
            .map((entry) => jsonEncode(entry.toJson()))
            .toList(),
      );
      return false;
    }
    final updated = <MediaItem>[item, ...current];
    await Hive.box('library').put(
      key,
      updated.take(80).map((entry) => jsonEncode(entry.toJson())).toList(),
    );
    return true;
  }

  static List<Map<String, dynamic>> comments(String key) {
    final value = Hive.box('library').get(key);
    if (value is! List) return const <Map<String, dynamic>>[];
    return value
        .whereType<Map>()
        .map((entry) => entry.cast<String, dynamic>())
        .toList();
  }

  static Future<void> addComment(String key, String text) async {
    final clean = text.trim();
    if (clean.isEmpty) return;
    final current = comments(key);
    await Hive.box('library').put(
      key,
      <Map<String, dynamic>>[
        <String, dynamic>{
          'author': 'You',
          'text': clean,
          'at': DateTime.now().millisecondsSinceEpoch,
        },
        ...current,
      ].take(200).toList(),
    );
  }
}
