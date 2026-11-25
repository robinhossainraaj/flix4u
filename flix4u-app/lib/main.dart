import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'app.dart';
import 'widgets/skeleton_loading.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Hive.initFlutter();
  await Hive.openBox('library');
  await Hive.openBox('settings');
  await Hive.openBox('downloads');
  runApp(const ShimmerScope(child: Flix4UApp()));
}
