import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../core/api/endpoints.dart';

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: <Widget>[
          const ListTile(
            leading: Icon(Icons.person_off),
            title: Text('Guest mode'),
            subtitle: Text('No login, no Firebase, data stored locally.'),
          ),
          ListTile(
            leading: const Icon(Icons.cloud),
            title: const Text('Backend'),
            subtitle: Text(kBackendBaseUrl),
          ),
          ListTile(
            leading: const Icon(Icons.info_outline),
            title: const Text('Version'),
            subtitle: Text(_version),
          ),
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              'Flix4U uses publicly available metadata and sources you configure. '
              'Only stream content you have the right to distribute.',
              style: TextStyle(color: Colors.white54),
            ),
          ),
        ],
      ),
    );
  }
}
