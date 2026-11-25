import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/media_item.dart';
import '../../data/repositories/catalog_repository.dart';
import '../../widgets/media_card.dart';

class SearchPage extends StatefulWidget {
  const SearchPage({super.key});

  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  final CatalogRepository _repository = CatalogRepository();
  final TextEditingController _controller = TextEditingController();
  String _type = 'all';
  Future<List<MediaItem>>? _future;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _runSearch() {
    setState(() {
      _future = _repository.search(_controller.text, type: _type);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Search Flix4U')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: <Widget>[
            TextField(
              controller: _controller,
              onSubmitted: (_) => _runSearch(),
              decoration: InputDecoration(
                hintText: 'Movie, series or anime name',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.arrow_forward),
                  onPressed: _runSearch,
                ),
              ),
            ),
            const SizedBox(height: 12),
            DropdownButton<String>(
              value: _type,
              onChanged: (value) => setState(() => _type = value ?? 'all'),
              items: const <DropdownMenuItem<String>>[
                DropdownMenuItem(value: 'all', child: Text('All')),
                DropdownMenuItem(value: 'movie', child: Text('Movies')),
                DropdownMenuItem(value: 'tv', child: Text('Web Series')),
                DropdownMenuItem(value: 'anime', child: Text('Anime')),
              ],
            ),
            const SizedBox(height: 12),
            Expanded(
              child: _future == null
                  ? const Center(child: Text('Type something and search.'))
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
                            child: Text('Search failed: ${snapshot.error}'),
                          );
                        }
                        final items = snapshot.data ?? const <MediaItem>[];
                        if (items.isEmpty) {
                          return const Center(child: Text('No results found.'));
                        }
                        return GridView.builder(
                          gridDelegate:
                              const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 3,
                                crossAxisSpacing: 12,
                                mainAxisSpacing: 12,
                                childAspectRatio: 0.62,
                              ),
                          itemCount: items.length,
                          itemBuilder: (context, index) {
                            final item = items[index];
                            return MediaCard(
                              item: item,
                              onTap: () => context.go(
                                '/detail/${item.type}/${Uri.encodeComponent(item.id)}',
                              ),
                            );
                          },
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
