import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants/app_colors.dart';

class AppTheme {
  AppTheme._();

  static ThemeData light({bool highContrast = false}) {
    final colorScheme = highContrast ? _highContrastScheme : _lightScheme;

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: highContrast
          ? AppColors.highContrastBg
          : AppColors.background,
      textTheme: _buildTextTheme(highContrast),
      appBarTheme: AppBarTheme(
        backgroundColor: highContrast
            ? AppColors.highContrastBg
            : AppColors.sunflowerYellow,
        foregroundColor: highContrast
            ? AppColors.highContrastText
            : AppColors.brownDark,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: GoogleFonts.nunito(
          fontSize: 22,
          fontWeight: FontWeight.w800,
          color: highContrast
              ? AppColors.highContrastText
              : AppColors.brownDark,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: highContrast
              ? AppColors.highContrastAccent
              : AppColors.sunflowerYellow,
          foregroundColor: highContrast
              ? AppColors.highContrastBg
              : AppColors.brownDark,
          minimumSize: const Size(double.infinity, 56),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: GoogleFonts.nunito(
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
          elevation: 2,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: highContrast
              ? AppColors.highContrastText
              : AppColors.brownDark,
          minimumSize: const Size(double.infinity, 56),
          side: BorderSide(
            color: highContrast
                ? AppColors.highContrastAccent
                : AppColors.sunflowerYellow,
            width: 2,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: GoogleFonts.nunito(
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: highContrast
            ? const Color(0xFF1A1A1A)
            : AppColors.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: highContrast
                ? AppColors.highContrastAccent
                : AppColors.brownLight,
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: highContrast
                ? AppColors.highContrastAccent
                : AppColors.brownLight,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: highContrast
                ? AppColors.highContrastAccent
                : AppColors.sunflowerYellow,
            width: 2,
          ),
        ),
        labelStyle: GoogleFonts.nunito(
          color: highContrast
              ? AppColors.highContrastText
              : AppColors.textSecondary,
          fontSize: 16,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
      ),
      cardTheme: CardThemeData(
        color: highContrast ? const Color(0xFF1A1A1A) : AppColors.surface,
        elevation: 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: highContrast
              ? const BorderSide(color: AppColors.highContrastAccent)
              : BorderSide.none,
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: highContrast
            ? AppColors.highContrastAccent
            : AppColors.sunflowerYellow,
        foregroundColor: highContrast
            ? AppColors.highContrastBg
            : AppColors.brownDark,
        elevation: 4,
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: highContrast
            ? AppColors.highContrastBg
            : AppColors.surface,
        selectedItemColor: highContrast
            ? AppColors.highContrastAccent
            : AppColors.sunflowerDark,
        unselectedItemColor: highContrast
            ? AppColors.highContrastText
            : AppColors.textSecondary,
        type: BottomNavigationBarType.fixed,
        selectedLabelStyle: GoogleFonts.nunito(
          fontSize: 13,
          fontWeight: FontWeight.w700,
        ),
        unselectedLabelStyle: GoogleFonts.nunito(
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  static TextTheme _buildTextTheme(bool highContrast) {
    final color = highContrast
        ? AppColors.highContrastText
        : AppColors.textPrimary;

    return TextTheme(
      headlineLarge: GoogleFonts.nunito(
        fontSize: 32,
        fontWeight: FontWeight.w800,
        color: color,
      ),
      headlineMedium: GoogleFonts.nunito(
        fontSize: 26,
        fontWeight: FontWeight.w700,
        color: color,
      ),
      headlineSmall: GoogleFonts.nunito(
        fontSize: 22,
        fontWeight: FontWeight.w700,
        color: color,
      ),
      titleLarge: GoogleFonts.nunito(
        fontSize: 20,
        fontWeight: FontWeight.w700,
        color: color,
      ),
      titleMedium: GoogleFonts.nunito(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: color,
      ),
      bodyLarge: GoogleFonts.nunito(
        fontSize: 17,
        fontWeight: FontWeight.w500,
        color: color,
      ),
      bodyMedium: GoogleFonts.nunito(
        fontSize: 15,
        fontWeight: FontWeight.w400,
        color: color,
      ),
      labelLarge: GoogleFonts.nunito(
        fontSize: 16,
        fontWeight: FontWeight.w700,
        color: color,
      ),
    );
  }

  static const ColorScheme _lightScheme = ColorScheme(
    brightness: Brightness.light,
    primary: AppColors.sunflowerYellow,
    onPrimary: AppColors.brownDark,
    secondary: AppColors.brownDark,
    onSecondary: AppColors.surface,
    error: AppColors.error,
    onError: AppColors.surface,
    surface: AppColors.surface,
    onSurface: AppColors.textPrimary,
  );

  static const ColorScheme _highContrastScheme = ColorScheme(
    brightness: Brightness.dark,
    primary: AppColors.highContrastAccent,
    onPrimary: AppColors.highContrastBg,
    secondary: AppColors.highContrastText,
    onSecondary: AppColors.highContrastBg,
    error: AppColors.errorLight,
    onError: AppColors.highContrastBg,
    surface: Color(0xFF1A1A1A),
    onSurface: AppColors.highContrastText,
  );
}
