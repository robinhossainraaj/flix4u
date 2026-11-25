import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'features/category/category_page.dart';
import 'features/detail/detail_page.dart';
import 'features/downloads/downloads_page.dart';
import 'features/home/home_page.dart';
import 'features/library/library_page.dart';
import 'features/player/player_page.dart';
import 'features/search/search_page.dart';
import 'features/settings/settings_page.dart';
import 'features/splash/splash_page.dart';
import 'theme/app_theme.dart';

final GoRouter _router = GoRouter(
  initialLocation: '/splash',
  routes: <RouteBase>[
    GoRoute(
      path: '/splash',
      builder: (BuildContext context, GoRouterState state) =>
          const SplashPage(),
    ),
    GoRoute(
      path: '/',
      builder: (BuildContext context, GoRouterState state) => const HomePage(),
    ),
    GoRoute(
      path: '/category/:key',
      builder: (BuildContext context, GoRouterState state) =>
          CategoryPage(categoryKey: state.pathParameters['key'] ?? 'movies'),
    ),
    GoRoute(
      path: '/detail/:type/:id',
      builder: (BuildContext context, GoRouterState state) => DetailPage(
        type: state.pathParameters['type'] ?? 'movie',
        id: state.pathParameters['id'] ?? '',
      ),
    ),
    GoRoute(
      path: '/player',
      builder: (BuildContext context, GoRouterState state) {
        final params = state.uri.queryParameters;
        return PlayerPage(
          url: params['url'] ?? '',
          title: params['title'] ?? 'Now Playing',
          referer: params['referer'],
        );
      },
    ),
    GoRoute(
      path: '/search',
      builder: (BuildContext context, GoRouterState state) =>
          const SearchPage(),
    ),
    GoRoute(
      path: '/library',
      builder: (BuildContext context, GoRouterState state) =>
          const LibraryPage(),
    ),
    GoRoute(
      path: '/downloads',
      builder: (BuildContext context, GoRouterState state) =>
          const DownloadsPage(),
    ),
    GoRoute(
      path: '/settings',
      builder: (BuildContext context, GoRouterState state) =>
          const SettingsPage(),
    ),
  ],
);

class Flix4UApp extends StatelessWidget {
  const Flix4UApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Flix4U',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark(),
      routerConfig: _router,
    );
  }
}
