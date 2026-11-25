import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../data/models/media_item.dart';
import '../theme/app_theme.dart';

class HeroCarousel extends StatefulWidget {
  const HeroCarousel({
    super.key,
    required this.items,
    required this.onPlay,
    this.onInfo,
  });

  final List<MediaItem> items;
  final ValueChanged<MediaItem> onPlay;
  final ValueChanged<MediaItem>? onInfo;

  @override
  State<HeroCarousel> createState() => _HeroCarouselState();
}

class _HeroCarouselState extends State<HeroCarousel> {
  final PageController _pageController = PageController(viewportFraction: 0.92);
  int _current = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  @override
  void didUpdateWidget(covariant HeroCarousel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.items.length != widget.items.length) _current = 0;
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  void _startTimer() {
    _timer?.cancel();
    if (widget.items.length < 2) return;
    _timer = Timer.periodic(const Duration(seconds: 6), (_) {
      if (!mounted || !_pageController.hasClients) return;
      final next = (_current + 1) % widget.items.length;
      _pageController.animateToPage(
        next,
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeInOutCubic,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty) return const _HeroPlaceholder();

    final count = widget.items.length > 6 ? 6 : widget.items.length;
    return Column(
      children: <Widget>[
        SizedBox(
          height: 238,
          child: PageView.builder(
            controller: _pageController,
            onPageChanged: (index) => setState(() => _current = index),
            itemCount: count,
            itemBuilder: (context, index) =>
                _heroCard(context, widget.items[index]),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List<Widget>.generate(count, (index) {
            final active = index == _current;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 240),
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: active ? 20 : 6,
              height: 5,
              decoration: BoxDecoration(
                color: active ? AppColors.accentSoft : AppColors.step4,
                borderRadius: BorderRadius.circular(8),
              ),
            );
          }),
        ),
      ],
    );
  }

  Widget _heroCard(BuildContext context, MediaItem item) {
    final imageUrl = item.backdrop.isNotEmpty ? item.backdrop : item.poster;
    final meta = <String>[
      if (item.year != null) item.year.toString(),
      if (item.genres.isNotEmpty) item.genres.take(2).join(' • '),
      if (item.rating != null) '★ ${item.rating!.toStringAsFixed(1)}',
    ].join('  ·  ');

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Material(
          color: AppColors.surface,
          child: InkWell(
            onTap: () => widget.onPlay(item),
            child: Stack(
              fit: StackFit.expand,
              children: <Widget>[
                if (imageUrl.isNotEmpty)
                  CachedNetworkImage(
                    imageUrl: imageUrl,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => const _HeroGradient(),
                    errorWidget: (_, __, ___) => const _HeroGradient(),
                  )
                else
                  const _HeroGradient(),
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: <Color>[
                        Color(0x1104202E),
                        Color(0xB304202E),
                        AppColors.step1,
                      ],
                      stops: <double>[0.0, 0.56, 1.0],
                    ),
                  ),
                ),
                Positioned(
                  left: 12,
                  top: 12,
                  child: Row(
                    children: <Widget>[
                      _badge('FEATURED'),
                      const SizedBox(width: 6),
                      _badge(item.type.toUpperCase()),
                    ],
                  ),
                ),
                Positioned(
                  left: 14,
                  right: 14,
                  bottom: 14,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Text(
                        item.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.text,
                          fontSize: 25,
                          height: 1.05,
                          fontWeight: FontWeight.w900,
                          shadows: <Shadow>[
                            Shadow(blurRadius: 14, color: Colors.black87),
                          ],
                        ),
                      ),
                      if (meta.isNotEmpty) ...<Widget>[
                        const SizedBox(height: 6),
                        Text(
                          meta,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: AppColors.accentSoft,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                      const SizedBox(height: 12),
                      Row(
                        children: <Widget>[
                          FilledButton.icon(
                            onPressed: () => widget.onPlay(item),
                            style: FilledButton.styleFrom(
                              minimumSize: const Size(0, 38),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                              ),
                            ),
                            icon: const Icon(Icons.play_arrow_rounded, size: 19),
                            label: const Text('Watch now'),
                          ),
                          const SizedBox(width: 8),
                          if (widget.onInfo != null)
                            OutlinedButton.icon(
                              onPressed: () => widget.onInfo!(item),
                              style: OutlinedButton.styleFrom(
                                minimumSize: const Size(0, 38),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                ),
                              ),
                              icon: const Icon(Icons.info_outline, size: 17),
                              label: const Text('Info'),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _badge(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xCC04202E),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: AppColors.accentSoft),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: AppColors.text,
          fontSize: 9,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.6,
        ),
      ),
    );
  }
}

class _HeroPlaceholder extends StatelessWidget {
  const _HeroPlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 238,
      margin: const EdgeInsets.symmetric(horizontal: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: AppColors.highlightGradient,
      ),
      child: const Center(
        child: Icon(
          Icons.play_circle_outline_rounded,
          size: 54,
          color: AppColors.step1,
        ),
      ),
    );
  }
}

class _HeroGradient extends StatelessWidget {
  const _HeroGradient();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(decoration: BoxDecoration(gradient: AppColors.cardGradient));
  }
}
