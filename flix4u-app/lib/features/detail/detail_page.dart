import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../../data/models/media_item.dart';
import '../../data/repositories/catalog_repository.dart';
import '../../data/repositories/stream_repository.dart';

class DetailPage extends StatefulWidget {
  const DetailPage({super.key, required this.type, required this.id});

  final String type;
  final String id;

  @override
  State<DetailPage> createState() => _DetailPageState();
}

class _DetailPageState extends State<DetailPage> {
  final CatalogRepository _catalog = CatalogRepository();
  final StreamRepository _streams = StreamRepository();
  final TextEditingController _episodeController = TextEditingController(
    text: '1',
  );
  bool _resolving = false;

  Box get _library => Hive.box('library');

  List<String> _saved(String key) {
    final value = _library.get(key);
    if (value is! List) return const <String>[];
    return value.map((e) => e.toString()).toList();
  }

  bool _has(String key, MediaItem item) =>
      _saved(key).contains(jsonEncode(item.toJson()));

  void _toggle(String key, MediaItem item) {
    final items = _saved(key);
    final encoded = jsonEncode(item.toJson());
    if (items.contains(encoded)) {
      items.remove(encoded);
    } else {
      items.add(encoded);
    }
    _library.put(key, items);
    setState(() {});
  }

  Future<void> _play(MediaItem item) async {
    setState(() => _resolving = true);
    try {
      final stream = await _streams.resolve(
        provider: item.provider,
        id: item.id,
        type: item.type,
        title: item.title,
        episode: _episodeController.text.trim().isEmpty
            ? '1'
            : _episodeController.text.trim(),
      );
      if (!stream.isValid) {
        throw const FormatException('Backend returned no playable stream URL.');
      }

      final continueList = _saved('continueWatching')
        ..removeWhere((e) => e != jsonEncode(item.toJson()));
      continueList.insert(0, jsonEncode(item.toJson()));
      await _library.put('continueWatching', continueList.take(20).toList());

      if (!mounted) return;
      context.push(
        '/player?url=${Uri.encodeComponent(stream.url)}'
        '&title=${Uri.encodeComponent(item.title)}'
        '&referer=${Uri.encodeComponent(stream.referer)}',
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not resolve stream: $error')),
      );
    } finally {
      if (mounted) setState(() => _resolving = false);
    }
  }

  @override
  void dispose() {
    _episodeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Details')),
      body: FutureBuilder<MediaItem>(
        future: _catalog.detail(widget.type, widget.id),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || !snapshot.hasData) {
            return Center(
              child: Text('Could not load details: ${snapshot.error}'),
            );
          }
          final item = snapshot.data!;
          final episodeBased = item.type == 'anime' || item.type == 'tv';
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  item.title,
                  style: Theme.of(context).textTheme.headlineSmall
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  '${item.type.toUpperCase()}  •  ${item.year ?? '—'}  •  '
                  '${item.rating?.toStringAsFixed(1) ?? '—'}  •  ${item.provider}',
                  style: Theme.of(context).textTheme.bodyMedium
                      ?.copyWith(color: Colors.white60),
                ),
                const SizedBox(height: 16),
                Text(
                  item.description.isEmpty
                      ? 'No description available.'
                      : item.description,
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  children: item.genres
                      .map((g) => Chip(label: Text(g)))
                      .toList(),
                ),
                const SizedBox(height: 20),
                Row(
                  children: <Widget>[
                    IconButton(
                      tooltip: 'Favorite',
                      icon: Icon(
                        _has('favorites', item)
                            ? Icons.favorite
                            : Icons.favorite_border,
                        color: _has('favorites', item) ? Colors.red : null,
                      ),
                      onPressed: () => _toggle('favorites', item),
                    ),
                    IconButton(
                      tooltip: 'Watchlist',
                      icon: Icon(
                        _has('watchlist', item)
                            ? Icons.bookmark
                            : Icons.bookmark_border,
                      ),
                      onPressed: () => _toggle('watchlist', item),
                    ),
                  ],
                ),
                if (episodeBased) ...<Widget>[
                  const SizedBox(height: 8),
                  TextField(
                    controller: _episodeController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Episode number',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.numbers),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                FilledButton.icon(
                  onPressed: _resolving ? null : () => _play(item),
                  icon: _resolving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.play_arrow),
                  label: Text(_resolving ? 'Resolving stream...' : 'Play'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
