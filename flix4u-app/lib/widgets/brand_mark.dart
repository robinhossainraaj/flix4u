import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Small gradient play mark used in the Home and Category headers.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 34, this.onTap});

  final double size;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(size / 2),
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            gradient: AppColors.brandGradient,
            borderRadius: BorderRadius.circular(size / 3),
            boxShadow: <BoxShadow>[
              BoxShadow(
                color: AppColors.accent.withOpacity(0.35),
                blurRadius: 12,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Icon(
            Icons.play_arrow_rounded,
            size: size * 0.66,
            color: AppColors.step1,
          ),
        ),
      ),
    );
  }
}
