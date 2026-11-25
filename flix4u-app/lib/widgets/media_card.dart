import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../data/models/media_item.dart';
import '../theme/app_theme.dart';

class MediaCard extends StatelessWidget {
  const MediaCard({
    super.key,
    required this.item,
    this.onTap,
    this.width = 168,
    this.imageHeight = 98,
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
        borderRadius: BorderRadius.circular(10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Stack(
              children: <Widget>[
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: item.poster.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: item.poster,
                          height: imageHeight,
                          width: width,
                          fit: BoxFit.cover,
                          placeholder: (_, __) =>
                              _ThumbPlaceholder(height: imageHeight),
                          errorWidget: (_, __, ___) =>
                              _ThumbPlaceholder(height: imageHeight),
                        )
                      : _ThumbPlaceholder(height: imageHeight),
                ),
                Positioned(
                  left: 7,
                  bottom: 7,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.72),
                      borderRadius: BorderRadius.circular(5),
                    ),
                    child: Text(
                      _typeLabel(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.4,
                      ),
                    ),
                  ),
                ),
                if (item.rating != null)
                  Positioned(
                    right: 7,
                    top: 7,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(5),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: <Widget>[
                          const Icon(
                            Icons.star_rounded,
                            size: 10,
                            color: Color(0xFF062315),
                          ),
                          const SizedBox(width: 2),
                          Text(
                            item.rating!.toStringAsFixed(1),
                            style: const TextStyle(
                              color: Color(0xFF062315),
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 7),
            Text(
              item.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.text,
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

  String _metaLine() {
    final parts = <String>[];
    if (item.year != null) parts.add(item.year.toString());
    if (item.genres.isNotEmpty) parts.add(item.genres.first);
    if (parts.isEmpty) parts.add(item.provider.toUpperCase());
    return parts.join(' • ');
  }
}

class _ThumbPlaceholder extends StatelessWidget {
  const _ThumbPlaceholder({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: <Color>[Color(0xFF2A2C33), Color(0xFF15161B)],
        ),
      ),
      child: const Icon(Icons.movie_rounded, color: Colors.white24, size: 28),
    );
  }
}
