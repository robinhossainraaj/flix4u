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
    this.imageHeight = 96,
  });

  final MediaItem item;
  final VoidCallback? onTap;
  final double width;
  final double imageHeight;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.surfaceAlt),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(11),
                  child: Stack(
                    children: <Widget>[
                      if (item.poster.isNotEmpty)
                        CachedNetworkImage(
                          imageUrl: item.poster,
                          height: imageHeight,
                          width: width,
                          fit: BoxFit.cover,
                          placeholder: (_, __) =>
                              _ThumbPlaceholder(height: imageHeight),
                          errorWidget: (_, __, ___) =>
                              _ThumbPlaceholder(height: imageHeight),
                        )
                      else
                        _ThumbPlaceholder(height: imageHeight),
                      const Positioned.fill(
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: <Color>[
                                Colors.transparent,
                                Color(0x99061418),
                              ],
                              stops: <double>[0.55, 1.0],
                            ),
                          ),
                        ),
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
                            color: const Color(0xCC061418),
                            borderRadius: BorderRadius.circular(5),
                            border: Border.all(color: Colors.white12),
                          ),
                          child: Text(
                            _typeLabel(),
                            style: const TextStyle(
                              color: AppColors.text,
                              fontSize: 8.5,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5,
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
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: <Widget>[
                                const Icon(
                                  Icons.star_rounded,
                                  size: 10,
                                  color: AppColors.onPrimary,
                                ),
                                const SizedBox(width: 2),
                                Text(
                                  item.rating!.toStringAsFixed(1),
                                  style: const TextStyle(
                                    color: AppColors.onPrimary,
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
                ),
              ),
              const SizedBox(height: 7),
              Text(
                item.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppColors.text,
                  fontSize: 13,
                  height: 1.15,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                _metaLine(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppColors.muted,
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
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
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: <Color>[AppColors.surfaceAlt, AppColors.deepest],
        ),
      ),
      child: const Icon(
        Icons.movie_rounded,
        color: AppColors.primaryDeep,
        size: 26,
      ),
    );
  }
}
