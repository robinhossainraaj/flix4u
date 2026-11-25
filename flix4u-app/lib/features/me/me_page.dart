import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../../theme/app_theme.dart';
import '../../widgets/app_bottom_nav.dart';
import '../../widgets/tab_pop_scope.dart';

class MePage extends StatelessWidget {
  const MePage({super.key});

  int _count(String key) {
    final value = Hive.box('library').get(key);
    return value is List ? value.length : 0;
  }

  @override
  Widget build(BuildContext context) {
    return TabPopScope(
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: const Text('Me'),
          actions: <Widget>[
            IconButton(
              icon: const Icon(Icons.settings_outlined),
              onPressed: () => context.push('/settings'),
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
                    border: Border.all(color: AppColors.surfaceAlt),
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: <Color>[AppColors.surfaceAlt, AppColors.surface],
                    ),
                  ),
                  child: Row(
                    children: <Widget>[
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.primary.withOpacity(0.14),
                          border: Border.all(color: AppColors.primaryDeep),
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
                                color: AppColors.muted,
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
                  onTap: () => context.push('/library'),
                ),
                _tile(
                  icon: Icons.favorite_border,
                  title: 'My List',
                  subtitle: '$favorites favorites • $watchlist watchlist',
                  onTap: () => context.push('/library'),
                ),
                _tile(
                  icon: Icons.download_outlined,
                  title: 'TV Download & Web Link',
                  subtitle: 'Offline area',
                  onTap: () => context.push('/downloads'),
                ),
                const SizedBox(height: 10),
                _section('App'),
                _tile(
                  icon: Icons.settings_outlined,
                  title: 'Settings',
                  subtitle: 'Backend, version and local data',
                  onTap: () => context.push('/settings'),
                ),
                _tile(
                  icon: Icons.info_outline,
                  title: 'About Flix4U',
                  subtitle: 'Guest-only streaming app',
                  onTap: () => context.push('/settings'),
                ),
                const SizedBox(height: 18),
                const Center(
                  child: Text(
                    'Flix4U • Guest mode',
                    style: TextStyle(color: AppColors.brand, fontSize: 11),
                  ),
                ),
              ],
            );
          },
        ),
        bottomNavigationBar: const AppBottomNav(selectedIndex: 3),
      ),
    );
  }

  Widget _section(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6, top: 4),
      child: Text(
        title,
        style: const TextStyle(
          color: AppColors.primaryDeep,
          fontSize: 11,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.2,
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
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.surfaceAlt),
      ),
      child: ListTile(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        leading: Icon(icon, color: AppColors.primaryDeep, size: 22),
        title: Text(
          title,
          style: const TextStyle(
            color: AppColors.text,
            fontSize: 14,
            fontWeight: FontWeight.w700,
          ),
        ),
        subtitle: Text(
          subtitle,
          style: const TextStyle(color: AppColors.muted, fontSize: 11),
        ),
        trailing: const Icon(
          Icons.chevron_right_rounded,
          color: AppColors.muted,
          size: 20,
        ),
        onTap: onTap,
      ),
    );
  }
}
