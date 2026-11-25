import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Makes Android back from a bottom-tab screen return to Home instead of
/// closing the app.
class TabPopScope extends StatelessWidget {
  const TabPopScope({super.key, required this.child, this.fallback = '/'});

  final Widget child;
  final String fallback;

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, Object? result) {
        if (didPop) return;
        if (context.canPop()) {
          context.pop();
        } else {
          context.go(fallback);
        }
      },
      child: child,
    );
  }
}
