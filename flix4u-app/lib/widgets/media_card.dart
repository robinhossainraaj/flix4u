import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../data/models/media_item.dart';
import '../theme/app_theme.dart';
import 'skeleton_loading.dart';

class MediaCard extends StatelessWidget {
  const MediaCard({
    super.key,
    required this.item,
    this.onTap,
    this.width = 122,
    this.imageHeight = 160,
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
          borderRadius: BorderRadius.circular(10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Stack(
                  children: <Widget>[
                    if (item.poster.isNotEmpty)
                      CachedNetworkImage(
                        imageUrl: item.poster,
                        height: imageHeight,
                        width: width,
                        fit: BoxFit.cover,
                        placeholder: (_, __) => SkeletonThumbnail(
                          width: width,
                          height: imageHeight,
                          radius: 8,
                        ),
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
                              Color(0x1104202E),
                              Color(0xCC04202E),
                            ],
                            stops: <double>[0.55, 1.0],
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      right: 5,
                      top: 5,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xCC04202E),
                          borderRadius: BorderRadius.circular(5),
                          border: Border.all(color: AppColors.accentSoft),
                        ),
                        child: Text(
                          item.languageLabel,
                          style: const TextStyle(
                            color: AppColors.text,
                            fontSize: 9.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                    if (item.rating != null)
                      Positioned(
                        right: 6,
                        bottom: 6,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: <Widget>[
                            const Icon(
                              Icons.star_rounded,
                              size: 13,
                              color: AppColors.accentSoft,
                            ),
                            const SizedBox(width: 2),
                            Text(
                              item.rating!.toStringAsFixed(1),
                              style: const TextStyle(
                                color: AppColors.text,
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 6),
              Text(
                item.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppColors.text,
                  fontSize: 12.5,
                  height: 1.2,
                  fontWeight: FontWeight.w700,
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
}

class _ThumbPlaceholder extends StatelessWidget {
  const _ThumbPlaceholder({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      width: double.infinity,
      decoration: const BoxDecoration(gradient: AppColors.cardGradient),
      child: const Center(
        child: Icon(
          Icons.movie_rounded,
          color: AppColors.accentSoft,
          size: 28,
        ),
      ),
    );
  }
}
