import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../../theme/app_theme.dart';
import '../../widgets/app_bottom_nav.dart';

class MePage extends StatelessWidget {
  const MePage({super.key});

  int _count(String key) {
    final value = Hive.box('library').get(key);
    return value is List ? value.length : 0;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Me'),
        actions: <Widget>[
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => context.go('/settings'),
            tooltip: 'Settings',
          ),
        ],
      ),
      body: ValueListenableBuilder(
        valueListenable: Hive.box('library').listenable(),
        builder: (context, _, __) {
          final history = _count('continueWatching');
          final favorites = _count('favorites');
          final watchlist = _count('watchlist');
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: <Widget>[
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  gradient: const LinearGradient(
                    colors: <Color>[Color(0xFF244A3A), Color(0xFF15161B)],
                  ),
                ),
                child: Row(
                  children: <Widget>[
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.primary.withOpacity(0.16),
                      ),
                      child: const Icon(
                        Icons.person_rounded,
                        size: 30,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            'Guest',
                            style: TextStyle(
                              color: AppColors.text,
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'No login. Your list stays on this device.',
                            style: TextStyle(
                              color: Colors.white70,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              _section('Library'),
              _tile(
                icon: Icons.history_rounded,
                title: 'Watch History',
                subtitle: '$history saved titles',
                onTap: () => context.go('/library'),
              ),
              _tile(
                icon: Icons.favorite_border,
                title: 'My List',
                subtitle: '$favorites favorites • $watchlist watchlist',
                onTap: () => context.go('/library'),
              ),
              _tile(
                icon: Icons.download_outlined,
                title: 'TV Download & Web Link',
                subtitle: 'Offline area',
                onTap: () => context.go('/downloads'),
              ),
              const SizedBox(height: 10),
              _section('App'),
              _tile(
                icon: Icons.settings_outlined,
                title: 'Settings',
                subtitle: 'Backend, version and local data',
                onTap: () => context.go('/settings'),
              ),
              _tile(
                icon: Icons.info_outline,
                title: 'About Flix4U',
                subtitle: 'Guest-only streaming app',
                onTap: () => context.go('/settings'),
              ),
              const SizedBox(height: 18),
              const Center(
                child: Text(
                  'Flix4U • MovieBox-inspired layout',
                  style: TextStyle(color: Colors.white30, fontSize: 11),
                ),
              ),
            ],
          );
        },
      ),
      bottomNavigationBar: const AppBottomNav(selectedIndex: 3),
    );
  }

  Widget _section(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6, top: 4),
      child: Text(
        title,
        style: const TextStyle(
          color: AppColors.primary,
          fontSize: 12,
          fontWeight: FontWeight.w800,
          letterSpacing: 1,
        ),
      ),
    );
  }

  Widget _tile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return ListTile(
      leading: Icon(icon),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: const Icon(Icons.chevron_right, color: Colors.white38),
      onTap: onTap,
    );
  }
}
