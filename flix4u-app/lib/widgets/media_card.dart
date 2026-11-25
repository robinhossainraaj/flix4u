import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../data/models/media_item.dart';

class MediaCard extends StatelessWidget {
  const MediaCard({super.key, required this.item, this.onTap});

  final MediaItem item;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 132,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: item.poster.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: item.poster,
                      height: 180,
                      width: 132,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => const _PosterPlaceholder(),
                      errorWidget: (_, __, ___) => const _PosterPlaceholder(),
                    )
                  : const _PosterPlaceholder(),
            ),
            const SizedBox(height: 8),
            Text(
              item.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium
                  ?.copyWith(fontWeight: FontWeight.w600),
            ),
            Text(
              '${item.type.toUpperCase()}  ${item.year ?? ''}',
              style: Theme.of(context).textTheme.bodySmall
                  ?.copyWith(color: Colors.white54),
            ),
          ],
        ),
      ),
    );
  }
}

class _PosterPlaceholder extends StatelessWidget {
  const _PosterPlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 180,
      width: 132,
      color: const Color(0xFF22242C),
      alignment: Alignment.center,
      child: const Icon(Icons.movie_rounded, color: Colors.white38, size: 40),
    );
  }
}
