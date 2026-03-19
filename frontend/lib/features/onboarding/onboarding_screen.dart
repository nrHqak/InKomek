import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../app_state.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_strings.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen>
    with SingleTickerProviderStateMixin {
  String? _selectedType;
  late AnimationController _animController;
  late Animation<double> _fadeAnim;

  static const _disabilityTypes = [
    _DisabilityOption(
      key: 'wheelchair',
      label: AppStrings.wheelchair,
      icon: Icons.accessible,
      color: AppColors.wheelchairBlue,
      description: 'Безбарьерные маршруты с пандусами',
    ),
    _DisabilityOption(
      key: 'blind',
      label: AppStrings.blind,
      icon: Icons.visibility_off,
      color: AppColors.blindPurple,
      description: 'Голосовая навигация и тактильные указатели',
    ),
    _DisabilityOption(
      key: 'elderly',
      label: AppStrings.elderly,
      icon: Icons.elderly,
      color: AppColors.elderlyGreen,
      description: 'Короткие маршруты с местами отдыха',
    ),
    _DisabilityOption(
      key: 'deaf',
      label: AppStrings.deaf,
      icon: Icons.hearing_disabled,
      color: AppColors.deafOrange,
      description: 'Визуальные уведомления и вибрация',
    ),
    _DisabilityOption(
      key: 'other',
      label: AppStrings.other,
      icon: Icons.person,
      color: AppColors.otherTeal,
      description: 'Общие настройки доступности',
    ),
  ];

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _fadeAnim = CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOut,
    );
    _animController.forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final isHc = state.highContrast;

    return Scaffold(
      body: SafeArea(
        child: FadeTransition(
          opacity: _fadeAnim,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              children: [
                const SizedBox(height: 32),
                _buildLogo(isHc),
                const SizedBox(height: 24),
                Text(
                  AppStrings.onboardingTitle,
                  style: Theme.of(context).textTheme.headlineMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  AppStrings.onboardingSubtitle,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: isHc
                            ? AppColors.highContrastText
                            : AppColors.textSecondary,
                      ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                Expanded(
                  child: ListView.separated(
                    itemCount: _disabilityTypes.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final option = _disabilityTypes[index];
                      return _buildOptionTile(option, isHc);
                    },
                  ),
                ),
                const SizedBox(height: 16),
                _buildContinueButton(state),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLogo(bool isHc) {
    return Container(
      width: 100,
      height: 100,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: isHc ? AppColors.highContrastBg : AppColors.sunflowerYellow,
        border: isHc
            ? Border.all(color: AppColors.highContrastAccent, width: 2)
            : null,
        boxShadow: isHc
            ? null
            : [
                BoxShadow(
                  color: AppColors.sunflowerYellow.withValues(alpha: 0.3),
                  blurRadius: 20,
                  spreadRadius: 2,
                ),
              ],
      ),
      child: ClipOval(
        child: Image.asset(
          'assets/images/logo.png',
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Icon(
            Icons.local_florist,
            size: 48,
            color: isHc ? AppColors.highContrastAccent : AppColors.brownDark,
          ),
        ),
      ),
    );
  }

  Widget _buildOptionTile(_DisabilityOption option, bool isHc) {
    final selected = _selectedType == option.key;
    final borderColor = selected
        ? (isHc ? AppColors.highContrastAccent : option.color)
        : (isHc ? AppColors.highContrastText.withValues(alpha: 0.3) : Colors.grey.shade300);
    final bgColor = selected
        ? (isHc
            ? AppColors.highContrastAccent.withValues(alpha: 0.15)
            : option.color.withValues(alpha: 0.08))
        : (isHc ? const Color(0xFF1A1A1A) : AppColors.surface);

    return Semantics(
      selected: selected,
      label: '${option.label}. ${option.description}',
      child: Material(
        color: bgColor,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => setState(() => _selectedType = option.key),
          child: Container(
            height: 72,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: borderColor, width: selected ? 2.5 : 1.5),
            ),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: selected
                        ? option.color
                        : option.color.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    option.icon,
                    color: selected ? Colors.white : option.color,
                    size: 26,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        option.label,
                        style: GoogleFonts.nunito(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: isHc
                              ? AppColors.highContrastText
                              : AppColors.textPrimary,
                        ),
                      ),
                      Text(
                        option.description,
                        style: GoogleFonts.nunito(
                          fontSize: 13,
                          color: isHc
                              ? AppColors.highContrastText.withValues(alpha: 0.7)
                              : AppColors.textSecondary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                if (selected)
                  Icon(
                    Icons.check_circle,
                    color: option.color,
                    size: 28,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildContinueButton(AppState state) {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton(
        onPressed: _selectedType == null ? null : () => _onContinue(state),
        style: ElevatedButton.styleFrom(
          disabledBackgroundColor: Colors.grey.shade300,
          disabledForegroundColor: Colors.grey.shade600,
        ),
        child: Text(
          AppStrings.continueButton,
          style: GoogleFonts.nunito(
            fontSize: 18,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }

  Future<void> _onContinue(AppState state) async {
    if (_selectedType == null) return;

    await state.setDisabilityType(_selectedType!);
    await state.completeOnboarding();

    if (_selectedType == 'blind') {
      await state.setVoiceControl(true);
      state.voiceService.speak(
        'Выбран тип: нарушение зрения. Голосовое управление включено.',
      );
    } else if (_selectedType == 'deaf') {
      await state.setVibrationAlerts(true);
    }

    if (mounted) {
      Navigator.of(context).pushReplacementNamed('/home');
    }
  }
}

class _DisabilityOption {
  final String key;
  final String label;
  final IconData icon;
  final Color color;
  final String description;

  const _DisabilityOption({
    required this.key,
    required this.label,
    required this.icon,
    required this.color,
    required this.description,
  });
}
