import 'package:flutter/material.dart';

import '../data/models/media_item.dart';
import '../theme/app_theme.dart';
import 'media_card.dart';

class SectionRail extends StatelessWidget {
  const SectionRail({
    super.key,
    required this.title,
    required this.items,
    this.subtitle,
    this.onSeeAll,
    this.onTap,
  });

  final String title;
  final String? subtitle;
  final List<MediaItem> items;
  final VoidCallback? onSeeAll;
  final ValueChanged<MediaItem>? onTap;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 13),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        title,
                        style: const TextStyle(
                          color: AppColors.text,
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      if (subtitle != null)
                        Text(
                          subtitle!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: AppColors.muted,
                            fontSize: 11,
                          ),
                        ),
                    ],
                  ),
                ),
                if (onSeeAll != null)
                  InkWell(
                    onTap: onSeeAll,
                    borderRadius: BorderRadius.circular(8),
                    child: const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: <Widget>[
                          Text(
                            'All',
                            style: TextStyle(
                              color: AppColors.accentSoft,
                              fontSize: 13.5,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          Icon(
                            Icons.chevron_right_rounded,
                            size: 17,
                            color: AppColors.accentSoft,
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 9),
          SizedBox(
            height: 198,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 13),
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(width: 9),
              itemBuilder: (context, index) {
                final item = items[index];
                return MediaCard(
                  item: item,
                  onTap: onTap == null ? null : () => onTap!(item),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
