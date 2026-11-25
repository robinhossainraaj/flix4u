import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Hive.initFlutter();
  await Hive.openBox('library');
  await Hive.openBox('settings');
  await Hive.openBox('downloads');
  runApp(const Flix4UApp());
}
