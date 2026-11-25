import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';
import '../../widgets/app_bottom_nav.dart';

class DownloadsPage extends StatelessWidget {
  const DownloadsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
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
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.primary.withOpacity(0.12),
                ),
                child: Icon(
                  Icons.download_rounded,
                  size: 58,
                  color: AppColors.primary.withOpacity(0.75),
                ),
              ),
              const SizedBox(height: 22),
              const Text(
                'Offline downloads',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'This area is ready for offline playback. A download manager will be added after the stream resolver is connected.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.muted, height: 1.5),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: const AppBottomNav(selectedIndex: 2),
    );
  }
}
