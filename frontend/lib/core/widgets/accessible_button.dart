import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants/app_colors.dart';

class AccessibleButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onPressed;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final double height;
  final double iconSize;
  final double fontSize;
  final bool isLoading;

  const AccessibleButton({
    super.key,
    required this.label,
    required this.icon,
    required this.onPressed,
    this.backgroundColor,
    this.foregroundColor,
    this.height = 72,
    this.iconSize = 28,
    this.fontSize = 18,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    final bg = backgroundColor ?? AppColors.sunflowerYellow;
    final fg = foregroundColor ?? AppColors.brownDark;

    return Semantics(
      button: true,
      label: label,
      child: Material(
        color: bg,
        borderRadius: BorderRadius.circular(16),
        elevation: 2,
        child: InkWell(
          onTap: isLoading ? null : onPressed,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            height: height,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                if (isLoading)
                  SizedBox(
                    width: iconSize,
                    height: iconSize,
                    child: CircularProgressIndicator(
                      strokeWidth: 3,
                      color: fg,
                    ),
                  )
                else
                  Icon(icon, size: iconSize, color: fg),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(
                    label,
                    style: GoogleFonts.nunito(
                      fontSize: fontSize,
                      fontWeight: FontWeight.w700,
                      color: fg,
                    ),
                  ),
                ),
                Icon(
                  Icons.chevron_right_rounded,
                  color: fg.withValues(alpha: 0.6),
                  size: 28,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class AccessibleIconButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onPressed;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final double size;

  const AccessibleIconButton({
    super.key,
    required this.label,
    required this.icon,
    required this.onPressed,
    this.backgroundColor,
    this.foregroundColor,
    this.size = 56,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: Material(
        color: backgroundColor ?? AppColors.sunflowerYellow,
        borderRadius: BorderRadius.circular(size / 2),
        elevation: 2,
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(size / 2),
          child: SizedBox(
            width: size,
            height: size,
            child: Icon(
              icon,
              color: foregroundColor ?? AppColors.brownDark,
              size: size * 0.5,
            ),
          ),
        ),
      ),
    );
  }
}
