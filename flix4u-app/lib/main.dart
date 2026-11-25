import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'app.dart';
import 'theme/app_theme.dart';
import 'widgets/skeleton_loading.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(AppSystemUi.dark);
  await Hive.initFlutter();
  await Hive.openBox('library');
  await Hive.openBox('settings');
  await Hive.openBox('downloads');
  runApp(const ShimmerScope(child: Flix4UApp()));
}
