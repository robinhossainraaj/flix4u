import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/app_theme.dart';

/// Home / ShortTV / Downloads / Me navigation from the reference mockups.
class AppBottomNav extends StatelessWidget {
  const AppBottomNav({super.key, required this.selectedIndex});

  final int selectedIndex;

  static const List<IconData> _icons = <IconData>[
    Icons.home_rounded,
    Icons.smart_display_rounded,
    Icons.file_download_rounded,
    Icons.person_rounded,
  ];

  static const List<String> _labels = <String>[
    'Home',
    'ShortTV',
    'Downloads',
    'Me',
  ];

  static const List<String> _routes = <String>[
    '/',
    '/shorttv',
    '/downloads',
    '/me',
  ];

  void _navigate(BuildContext context, int index) {
    if (index == selectedIndex) return;
    context.go(_routes[index]);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 76,
      decoration: const BoxDecoration(
        color: AppColors.step2,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(18),
          topRight: Radius.circular(18),
        ),
        border: Border(top: BorderSide(color: AppColors.step4, width: 0.6)),
        boxShadow: <BoxShadow>[
          BoxShadow(
            color: Color(0x99021420),
            blurRadius: 18,
            offset: Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: List<Widget>.generate(4, (index) {
            final selected = index == selectedIndex;
            return Expanded(
              child: InkWell(
                onTap: () => _navigate(context, index),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: <Widget>[
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 220),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        gradient: selected
                            ? AppColors.highlightGradient
                            : null,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(
                        _icons[index],
                        size: 25,
                        color: selected ? AppColors.step1 : AppColors.muted,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      _labels[index],
                      style: TextStyle(
                        color: selected ? AppColors.text : AppColors.muted,
                        fontSize: 11.5,
                        fontWeight: selected
                            ? FontWeight.w800
                            : FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
        ),
      ),
    );
  }
}
