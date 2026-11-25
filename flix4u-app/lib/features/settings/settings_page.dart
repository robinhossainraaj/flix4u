import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../core/api/endpoints.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_back_button.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  String _version = '1.0.0';

  @override
  void initState() {
    super.initState();
    PackageInfo.fromPlatform()
        .then((info) {
          if (!mounted) return;
          setState(() => _version = '${info.version}+${info.buildNumber}');
        })
        .catchError((_) {});
  }

  Future<void> _clearData() async {
    await Hive.box('library').clear();
    await Hive.box('settings').clear();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Local library and preferences cleared.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: const AppBackButton(fallback: '/me'),
        title: const Text(
          'Settings',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 21),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: <Widget>[
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.surfaceAlt),
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: <Color>[AppColors.surfaceAlt, AppColors.surface],
              ),
            ),
            child: const Row(
              children: <Widget>[
                Icon(
                  Icons.person_off_rounded,
                  size: 38,
                  color: AppColors.primaryDeep,
                ),
                SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        'Guest mode',
                        style: TextStyle(
                          color: AppColors.text,
                          fontWeight: FontWeight.w800,
                          fontSize: 17,
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'No login, no Firebase, no account required.',
                        style: TextStyle(color: AppColors.muted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          _sectionTitle('App'),
          _tile(
            icon: Icons.cloud_outlined,
            title: 'Backend',
            subtitle: kBackendBaseUrl,
          ),
          _tile(
            icon: Icons.info_outline_rounded,
            title: 'Version',
            subtitle: _version,
          ),
          const SizedBox(height: 12),
          _sectionTitle('Data'),
          ListTile(
            leading: const Icon(Icons.delete_outline, color: AppColors.danger),
            title: const Text('Clear local data'),
            subtitle: const Text('Removes favorites, watchlist and history.'),
            onTap: _clearData,
          ),
          const SizedBox(height: 20),
          const Card(
            color: AppColors.surface,
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Flix4U uses publicly available metadata and sources you configure. '
                'Only stream content you have the right to distribute.',
                style: TextStyle(color: AppColors.muted, height: 1.5),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
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
  }) {
    return ListTile(
      leading: Icon(icon, color: AppColors.primaryDeep),
      title: Text(title),
      subtitle: Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis),
    );
  }
}
