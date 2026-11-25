import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';
import '../../widgets/app_bottom_nav.dart';
import '../../widgets/tab_pop_scope.dart';

class DownloadsPage extends StatelessWidget {
  const DownloadsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return TabPopScope(
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: const Text(
            'Downloads',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 21),
          ),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Container(
                  width: 118,
                  height: 118,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.surface,
                    border: Border.all(color: AppColors.surfaceAlt),
                  ),
                  child: const Icon(
                    Icons.download_rounded,
                    size: 54,
                    color: AppColors.primaryDeep,
                  ),
                ),
                const SizedBox(height: 22),
                const Text(
                  'Offline downloads',
                  style: TextStyle(
                    color: AppColors.text,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'This area is ready for offline playback. A download manager '
                  'will be added after the stream resolver is connected.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.muted, height: 1.5),
                ),
              ],
            ),
          ),
        ),
        bottomNavigationBar: const AppBottomNav(selectedIndex: 2),
      ),
    );
  }
}
