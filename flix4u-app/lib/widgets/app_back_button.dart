import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/app_theme.dart';

/// Explicit back button for screens that are pushed on top of another route.
class AppBackButton extends StatelessWidget {
  const AppBackButton({super.key, this.fallback = '/'});

  final String fallback;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Back',
      onPressed: () {
        if (context.canPop()) {
          context.pop();
        } else {
          context.go(fallback);
        }
      },
      icon: const Icon(
        Icons.arrow_back_ios_new,
        size: 20,
        color: AppColors.text,
      ),
    );
  }
}
