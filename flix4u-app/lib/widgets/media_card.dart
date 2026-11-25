import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../data/models/media_item.dart';
import '../theme/app_theme.dart';

class MediaCard extends StatelessWidget {
  const MediaCard({
    super.key,
    required this.item,
    this.onTap,
    this.width = 132,
    this.imageHeight = 176,
  });

  final MediaItem item;
  final VoidCallback? onTap;
  final double width;
  final double imageHeight;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Stack(
              children: <Widget>[
                ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: item.poster.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: item.poster,
                          height: imageHeight,
                          width: width,
                          fit: BoxFit.cover,
                          placeholder: (_, __) =>
                              _PosterPlaceholder(height: imageHeight),
                          errorWidget: (_, __, ___) =>
                              _PosterPlaceholder(height: imageHeight),
                        )
                      : _PosterPlaceholder(height: imageHeight),
                ),
                Positioned(
                  top: 8,
                  left: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 7,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: _typeColor().withOpacity(0.92),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      _typeLabel(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ),
                if (item.rating != null)
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.68),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: <Widget>[
                          const Icon(
                            Icons.star_rounded,
                            size: 11,
                            color: AppColors.gold,
                          ),
                          const SizedBox(width: 3),
                          Text(
                            item.rating!.toStringAsFixed(1),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              item.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              _metaLine(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppColors.muted, fontSize: 10),
            ),
          ],
        ),
      ),
    );
  }

  String _typeLabel() {
    switch (item.type) {
      case 'tv':
        return 'SERIES';
      case 'anime':
        return 'ANIME';
      default:
        return 'MOVIE';
    }
  }

  Color _typeColor() {
    switch (item.type) {
      case 'tv':
        return const Color(0xFF0EA5E9);
      case 'anime':
        return const Color(0xFFEC4899);
      default:
        return AppColors.primary;
    }
  }

  String _metaLine() {
    final parts = <String>[];
    if (item.year != null) parts.add(item.year.toString());
    if (item.genres.isNotEmpty) parts.add(item.genres.first);
    if (parts.isEmpty) parts.add(item.provider.toUpperCase());
    return parts.join(' • ');
  }
}

class _PosterPlaceholder extends StatelessWidget {
  const _PosterPlaceholder({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: <Color>[Color(0xFF27233A), Color(0xFF12141B)],
        ),
      ),
      alignment: Alignment.center,
      child: const Icon(Icons.movie_rounded, color: Colors.white24, size: 40),
    );
  }
}
