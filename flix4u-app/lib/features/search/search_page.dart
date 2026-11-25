import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

import '../../core/playback/play_media.dart';
import '../../core/local/local_lists.dart';
import '../../data/models/media_item.dart';
import '../../data/repositories/catalog_repository.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_back_button.dart';
import '../../widgets/tab_pop_scope.dart';

class SearchPage extends StatefulWidget {
  const SearchPage({super.key});

  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  static const List<MapEntry<String, String>> _tabs =
      <MapEntry<String, String>>[
        MapEntry<String, String>('movie', 'Movie'),
        MapEntry<String, String>('tv', 'Series'),
        MapEntry<String, String>('short', 'Short TV'),
        MapEntry<String, String>('music', 'Music'),
        MapEntry<String, String>('community', 'Community'),
      ];

  static const List<String> _popular = <String>[
    'The Terminal List',
    'The Witcher',
    'The Mentalist [ترجمة عربية]',
    'The Punisher',
    'Dr. Stone',
    'Black Torch',
  ];

  final CatalogRepository _repository = CatalogRepository();
  final TextEditingController _controller = TextEditingController();
  final stt.SpeechToText _speech = stt.SpeechToText();
  final TextEditingController _commentController = TextEditingController();

  String _tab = 'movie';
  Future<List<MediaItem>>? _future;
  bool _listening = false;
  String? _error;

  Box get _settings => Hive.box('settings');

  List<String> get _recent {
    final value = _settings.get('recentSearches');
    if (value is! List) return const <String>[];
    return value.map((e) => e.toString()).take(8).toList();
  }

  @override
  void dispose() {
    _controller.dispose();
    _commentController.dispose();
    _speech.cancel();
    super.dispose();
  }

  void _runSearch([String? preset]) {
    final query = (preset ?? _controller.text).trim();
    if (query.isEmpty) {
      setState(() => _future = null);
      return;
    }
    if (preset != null) _controller.text = preset;
    final recent = _recent.where((entry) => entry != query).toList();
    _settings.put(
      'recentSearches',
      <String>[query, ...recent].take(8).toList(),
    );
    setState(() {
      _error = null;
      _future = _tab == 'community'
          ? null
          : _repository.search(query, type: _tab);
    });
  }

  void _selectTab(String tab) {
    setState(() => _tab = tab);
    if (_controller.text.trim().isNotEmpty) _runSearch();
  }

  Future<void> _toggleMic() async {
    if (_listening) {
      await _speech.stop();
      if (mounted) setState(() => _listening = false);
      return;
    }
    final available = await _speech.initialize(
      onError: (error) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Voice search error: ${error.errorMsg}')),
          );
        }
      },
    );
    if (!available) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Voice search is not available on this device.'),
          ),
        );
      }
      return;
    }
    setState(() => _listening = true);
    await _speech.listen(
      onResult: (result) {
        if (!mounted || result.recognizedWords.isEmpty) return;
        _controller.text = result.recognizedWords;
        _controller.selection = TextSelection.collapsed(
          offset: _controller.text.length,
        );
      },
      listenOptions: stt.SpeechListenOptions(
        listenMode: stt.ListenMode.search,
        partialResults: true,
        listenFor: const Duration(seconds: 10),
        pauseFor: const Duration(seconds: 3),
      ),
    );
    if (mounted) setState(() => _listening = false);
  }

  @override
  Widget build(BuildContext context) {
    return TabPopScope(
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: SafeArea(
          child: Column(
            children: <Widget>[
              _header(),
              const Divider(height: 1, color: AppColors.step3),
              Expanded(
                child: _future == null && _tab != 'community'
                    ? _suggestions()
                    : _tab == 'community'
                    ? _community()
                    : _results(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      child: Row(
        children: <Widget>[
          const AppBackButton(fallback: '/'),
          const SizedBox(width: 2),
          Expanded(
            child: Container(
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.step3.withOpacity(0.48),
                borderRadius: BorderRadius.circular(7),
                border: Border.all(color: AppColors.step4.withOpacity(0.45)),
              ),
              child: Row(
                children: <Widget>[
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 12),
                    child: Icon(
                      Icons.search_rounded,
                      size: 19,
                      color: AppColors.accentSoft,
                    ),
                  ),
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      onSubmitted: (_) => _runSearch(),
                      textInputAction: TextInputAction.search,
                      style: const TextStyle(
                        color: AppColors.text,
                        fontSize: 15,
                      ),
                      decoration: const InputDecoration(
                        hintText: 'Search movies, series, anime',
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        contentPadding: EdgeInsets.symmetric(vertical: 10),
                      ),
                    ),
                  ),
                  InkWell(
                    onTap: () => _runSearch(),
                    child: const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      child: Text(
                        'Search',
                        style: TextStyle(
                          color: AppColors.step6,
                          fontSize: 14.5,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 4),
          IconButton(
            onPressed: _toggleMic,
            tooltip: _listening ? 'Stop voice search' : 'Voice search',
            icon: Icon(
              _listening ? Icons.mic : Icons.mic_none_rounded,
              color: _listening ? AppColors.accent : AppColors.text,
            ),
          ),
        ],
      ),
    );
  }

  Widget _suggestions() {
    final recent = _recent;
    return ListView(
      padding: const EdgeInsets.fromLTRB(13, 12, 13, 28),
      children: <Widget>[
        Row(
          children: <Widget>[
            const Text(
              'Recent',
              style: TextStyle(
                color: AppColors.text,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const Spacer(),
            if (recent.isNotEmpty)
              InkWell(
                onPressed: () => _settings.delete('recentSearches'),
                child: const Row(
                  children: <Widget>[
                    Icon(
                      Icons.delete_outline,
                      size: 15,
                      color: AppColors.muted,
                    ),
                    SizedBox(width: 4),
                    Text(
                      'Clear',
                      style: TextStyle(color: AppColors.muted, fontSize: 14),
                    ),
                  ],
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),
        if (recent.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 14),
            child: Text(
              'Your recent searches will appear here.',
              style: TextStyle(color: AppColors.hint, fontSize: 13),
            ),
          )
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: recent
                .map(
                  (term) => _chip(
                    term,
                    onTap: () => _runSearch(term),
                  ),
                )
                .toList(),
          ),
        const SizedBox(height: 24),
        Row(
          children: <Widget>[
            const Icon(
              Icons.local_fire_department_rounded,
              color: Color(0xFFFFB02E),
              size: 20,
            ),
            const SizedBox(width: 7),
            const Text(
              'Everyone is searching',
              style: TextStyle(
                color: AppColors.text,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _popular
              .map(
                (term) => _chip(
                  term,
                  onTap: () => _runSearch(term),
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 26),
        _tabsRow(),
      ],
    );
  }

  Widget _chip(String label, {required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(5),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 190),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.step3.withOpacity(0.50),
          borderRadius: BorderRadius.circular(5),
          border: Border.all(color: AppColors.step4.withOpacity(0.55)),
        ),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: AppColors.text, fontSize: 13.5),
        ),
      ),
    );
  }

  Widget _tabsRow() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        SizedBox(
          height: 34,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _tabs.length,
            separatorBuilder: (_, __) => const SizedBox(width: 22),
            itemBuilder: (context, index) {
              final entry = _tabs[index];
              final selected = entry.key == _tab;
              return InkWell(
                onTap: () => _selectTab(entry.key),
                child: Text(
                  entry.value,
                  style: TextStyle(
                    color: selected ? AppColors.text : AppColors.muted,
                    fontSize: selected ? 18 : 15,
                    fontWeight: selected ? FontWeight.w900 : FontWeight.w600,
                  ),
                ),
              );
            },
          ),
        ),
        const Divider(height: 1, color: AppColors.step3),
      ],
    );
  }

  Widget _results() {
    return Column(
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.fromLTRB(13, 8, 13, 6),
          child: _tabsRow(),
        ),
        Expanded(
          child: FutureBuilder<List<MediaItem>>(
            future: _future,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(
                  child: CircularProgressIndicator(color: AppColors.accent),
                );
              }
              if (snapshot.hasError || _error != null) {
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        const Icon(
                          Icons.wifi_off_rounded,
                          size: 40,
                          color: AppColors.muted,
                        ),
                        const SizedBox(height: 10),
                        Text(
                          'Search failed. ${snapshot.error ?? _error ?? ''}',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AppColors.muted),
                        ),
                        const SizedBox(height: 12),
                        FilledButton(
                          onPressed: () => _runSearch(),
                          child: const Text('Try again'),
                        ),
                      ],
                    ),
                  ),
                );
              }
              final items = snapshot.data ?? const <MediaItem>[];
              if (items.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      const Icon(
                        Icons.search_off_rounded,
                        size: 44,
                        color: AppColors.muted,
                      ),
                      const SizedBox(height: 10),
                      const Text(
                        'No results for this search.',
                        style: TextStyle(color: AppColors.muted),
                      ),
                      const SizedBox(height: 10),
                      OutlinedButton(
                        onPressed: () => _runSearch(),
                        child: const Text('Search again'),
                      ),
                    ],
                  ),
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.fromLTRB(13, 8, 13, 24),
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) =>
                    _resultTile(items[index], index + 1),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _resultTile(MediaItem item, int rank) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: () => playMedia(context, item),
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: <Widget>[
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: Stack(
                  children: <Widget>[
                    SizedBox(
                      width: 55,
                      height: 74,
                      child: item.poster.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: item.poster,
                              fit: BoxFit.cover,
                              errorWidget: (_, __, ___) => const _PosterFallback(),
                              placeholder: (_, __) => const _PosterFallback(),
                            )
                          : const _PosterFallback(),
                    ),
                    Positioned(
                      left: 0,
                      top: 0,
                      child: Container(
                        width: 17,
                        height: 17,
                        color: rank == 1
                            ? const Color(0xFFFF2B8E)
                            : rank == 2
                            ? const Color(0xFFFF7A1C)
                            : rank == 3
                            ? const Color(0xFFF2A91C)
                            : AppColors.step4,
                        child: Center(
                          child: Text(
                            '$rank',
                            style: const TextStyle(
                              color: AppColors.text,
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      item.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.text,
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      '🎬 | ★ ${item.rating?.toStringAsFixed(1) ?? '—'} | ${item.year ?? '—'} | ${item.country ?? item.languageLabel} | ${item.genres.take(2).join(', ')}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.play_circle_fill_rounded,
                color: AppColors.accent,
                size: 27,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _community() {
    final query = _controller.text.trim();
    final key = 'comments:search:${query.isEmpty ? 'general' : query}';
    return ValueListenableBuilder(
      valueListenable: Hive.box('library').listenable(),
      builder: (context, _, __) {
        final comments = LocalLists.comments(key);
        return Column(
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(13, 8, 13, 6),
              child: _tabsRow(),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(13, 8, 13, 10),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: TextField(
                      controller: _commentController,
                      style: const TextStyle(color: AppColors.text),
                      decoration: InputDecoration(
                        hintText: query.isEmpty
                            ? 'Say something about Flix4U'
                            : 'Talk about "$query"',
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: () async {
                      final text = _commentController.text;
                      if (text.trim().isEmpty) return;
                      await LocalLists.addComment(key, text);
                      _commentController.clear();
                    },
                    child: const Text('Post'),
                  ),
                ],
              ),
            ),
            Expanded(
              child: comments.isEmpty
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(28),
                        child: Text(
                          'No local comments yet. Be the first to post.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: AppColors.muted),
                        ),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(13, 0, 13, 24),
                      itemCount: comments.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final comment = comments[index];
                        return ListTile(
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          tileColor: AppColors.surface,
                          leading: const CircleAvatar(
                            backgroundColor: AppColors.step4,
                            child: Icon(
                              Icons.person_rounded,
                              color: AppColors.step1,
                              size: 18,
                            ),
                          ),
                          title: Text(
                            (comment['author'] ?? 'You').toString(),
                            style: const TextStyle(
                              color: AppColors.text,
                              fontWeight: FontWeight.w800,
                              fontSize: 13,
                            ),
                          ),
                          subtitle: Text(
                            (comment['text'] ?? '').toString(),
                            style: const TextStyle(color: AppColors.muted),
                          ),
                        );
                      },
                    ),
            ),
          ],
        );
      },
    );
  }
}

class _PosterFallback extends StatelessWidget {
  const _PosterFallback();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(gradient: AppColors.cardGradient),
      child: const Icon(
        Icons.movie_rounded,
        color: AppColors.accentSoft,
        size: 20,
      ),
    );
  }
}
