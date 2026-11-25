import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../../data/models/media_item.dart';
import '../../data/repositories/stream_repository.dart';
import '../../theme/app_theme.dart';

/// Resolves a stream and opens the player directly.
///
/// Content taps no longer open the summary/detail route. A small loading dialog
/// is shown while the resolver runs, then the player is pushed.
Future<void> playMedia(
  BuildContext context,
  MediaItem item, {
  String episode = '1',
}) async {
  final messenger = ScaffoldMessenger.of(context);
  var dialogVisible = true;

  showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (dialogContext) {
      return PopScope(
        canPop: false,
        child: AlertDialog(
          backgroundColor: AppColors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
          content: Row(
            children: <Widget>[
              const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2.4),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Text(
                  'Finding a stream for\n${item.title}',
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.text),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );

  try {
    final stream = await StreamRepository().resolve(
      provider: item.provider,
      id: item.id,
      type: item.type,
      title: item.title,
      episode: episode,
    );

    if (!context.mounted) return;
    if (dialogVisible) {
      Navigator.of(context, rootNavigator: true).pop();
      dialogVisible = false;
    }

    if (!stream.isValid) {
      throw const FormatException('No playable stream URL was returned.');
    }

    await _saveContinueWatching(item);
    if (!context.mounted) return;

    context.push(
      '/player?url=${Uri.encodeComponent(stream.url)}'
      '&title=${Uri.encodeComponent(item.title)}'
      '&referer=${Uri.encodeComponent(stream.referer)}'
      '&id=${Uri.encodeComponent(item.id)}'
      '&type=${Uri.encodeComponent(item.type)}'
      '&source=${Uri.encodeComponent(jsonEncode(stream.toJson()))}',
    );
  } catch (error) {
    if (!context.mounted) return;
    if (dialogVisible) {
      Navigator.of(context, rootNavigator: true).pop();
      dialogVisible = false;
    }
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          'Could not play this title. ${_friendlyError(error)}',
          maxLines: 3,
        ),
      ),
    );
  }
}

Future<void> _saveContinueWatching(MediaItem item) async {
  final box = Hive.box('library');
  final current = box.get('continueWatching');
  final encoded = jsonEncode(item.toJson());
  final entries = <String>[];
  if (current is List) {
    for (final entry in current) {
      final value = entry.toString();
      if (value != encoded) entries.add(value);
    }
  }
  entries.insert(0, encoded);
  await box.put('continueWatching', entries.take(20).toList());
}

String _friendlyError(Object error) {
  final raw = error.toString();
  if (raw.contains('No public stream source') ||
      raw.contains('No playable video')) {
    return 'This title has no public stream yet.';
  }
  if (raw.contains('SocketException') ||
      raw.contains('connection') ||
      raw.contains('timeout')) {
    return 'Check your internet connection and try again.';
  }
  return raw.replaceFirst('Exception: ', '');
}
