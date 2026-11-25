import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// The exact seven-step palette supplied for Flix4U.
///
/// Dark blue surfaces with bright cyan highlights. The lightest steps are used
/// for text, active chips, buttons and focus states so the interface reads as
/// highlighted rather than flat.
class AppColors {
  static const Color step1 = Color(0xFF04202E);
  static const Color step2 = Color(0xFF0A3C55);
  static const Color step3 = Color(0xFF0F5D83);
  static const Color step4 = Color(0xFF1786B4);
  static const Color step5 = Color(0xFF4FB2DB);
  static const Color step6 = Color(0xFF98D4EE);
  static const Color step7 = Color(0xFFE1F2FA);

  static const Color background = step1;
  static const Color deepest = step1;
  static const Color surface = step2;
  static const Color surfaceAlt = step3;
  static const Color primary = step4;
  static const Color primaryDeep = step3;
  static const Color brand = step4;
  static const Color accent = step5;
  static const Color accentSoft = step6;
  static const Color gold = step6;
  static const Color text = step7;
  static const Color muted = Color(0xC798D4EE);
  static const Color hint = Color(0x8F98D4EE);
  static const Color onPrimary = step1;
  static const Color danger = Color(0xFFFFB4A2);

  static const LinearGradient brandGradient = LinearGradient(
    colors: <Color>[step5, step6, step7],
  );

  static const LinearGradient highlightGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: <Color>[step4, step5, step6],
  );

  static const LinearGradient cardGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: <Color>[step3, step2, step1],
  );

  static const LinearGradient resourceGradient = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: <Color>[step3, step2, step4],
  );
}

/// System chrome styling shared by the native Android bootstrap and Flutter.
class AppSystemUi {
  const AppSystemUi._();

  static const SystemUiOverlayStyle dark = SystemUiOverlayStyle(
    statusBarColor: AppColors.background,
    statusBarIconBrightness: Brightness.light,
    statusBarBrightness: Brightness.dark,
    systemNavigationBarColor: AppColors.background,
    systemNavigationBarDividerColor: AppColors.background,
    systemNavigationBarIconBrightness: Brightness.light,
  );
}

class AppTheme {
  static ThemeData dark() {
    const scheme = ColorScheme.dark(
      primary: AppColors.step4,
      onPrimary: AppColors.step1,
      secondary: AppColors.step5,
      onSecondary: AppColors.step1,
      tertiary: AppColors.step6,
      onTertiary: AppColors.step1,
      surface: AppColors.step2,
      onSurface: AppColors.step7,
      error: AppColors.danger,
      onError: AppColors.step1,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.background,
      canvasColor: AppColors.background,
      cardColor: AppColors.surface,
      dividerColor: AppColors.step3,
      splashColor: AppColors.accent.withOpacity(0.18),
      highlightColor: AppColors.accentSoft.withOpacity(0.08),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.background,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        foregroundColor: AppColors.text,
        iconTheme: IconThemeData(color: AppColors.text),
        titleTextStyle: TextStyle(
          color: AppColors.text,
          fontSize: 20,
          fontWeight: FontWeight.w800,
        ),
      ),
      iconTheme: const IconThemeData(color: AppColors.text),
      textTheme: const TextTheme(
        displayLarge: TextStyle(color: AppColors.text, fontWeight: FontWeight.w900),
        displayMedium: TextStyle(color: AppColors.text, fontWeight: FontWeight.w900),
        titleLarge: TextStyle(
          color: AppColors.text,
          fontWeight: FontWeight.w800,
          fontSize: 21,
        ),
        titleMedium: TextStyle(
          color: AppColors.text,
          fontWeight: FontWeight.w700,
          fontSize: 16,
        ),
        bodyLarge: TextStyle(color: AppColors.text, fontSize: 15),
        bodyMedium: TextStyle(color: AppColors.text, fontSize: 13.5),
        bodySmall: TextStyle(color: AppColors.muted, fontSize: 12),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: AppColors.onPrimary,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: AppColors.onPrimary,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.text,
          side: const BorderSide(color: AppColors.accent),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          foregroundColor: AppColors.accentSoft,
          highlightColor: AppColors.accent.withOpacity(0.16),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.step3.withOpacity(0.42),
        hintStyle: const TextStyle(color: AppColors.hint),
        prefixIconColor: AppColors.accentSoft,
        suffixIconColor: AppColors.accentSoft,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.step4),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: AppColors.step4.withOpacity(0.60)),
        ),
        focusedBorder: const OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(14)),
          borderSide: BorderSide(color: AppColors.accent, width: 1.8),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.step3.withOpacity(0.48),
        selectedColor: AppColors.accent,
        disabledColor: AppColors.surface,
        labelStyle: const TextStyle(color: AppColors.text),
        secondaryLabelStyle: const TextStyle(
          color: AppColors.onPrimary,
          fontWeight: FontWeight.w800,
        ),
        showCheckmark: false,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        side: const BorderSide(color: AppColors.step4),
      ),
      tabBarTheme: const TabBarThemeData(
        indicatorColor: AppColors.accent,
        labelColor: AppColors.text,
        unselectedLabelColor: AppColors.muted,
        dividerColor: AppColors.step3,
        labelStyle: TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
        unselectedLabelStyle: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.accent,
        linearTrackColor: AppColors.step3,
        circularTrackColor: AppColors.step3,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.step2,
        surfaceTintColor: Colors.transparent,
        indicatorColor: AppColors.accent.withOpacity(0.22),
        height: 70,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            fontSize: 11.5,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
            color: selected ? AppColors.text : AppColors.muted,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: AppColors.accent);
          }
          return const IconThemeData(color: AppColors.muted);
        }),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        modalBackgroundColor: AppColors.surface,
        showDragHandle: true,
        dragHandleColor: AppColors.accent,
      ),
      snackBarTheme: const SnackBarThemeData(
        backgroundColor: AppColors.step3,
        contentTextStyle: TextStyle(color: AppColors.text),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(12)),
        ),
      ),
      dialogTheme: const DialogThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
      ),
      listTileTheme: const ListTileThemeData(
        iconColor: AppColors.accentSoft,
        textColor: AppColors.text,
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: AppColors.step3),
        ),
      ),
    );
  }
}
