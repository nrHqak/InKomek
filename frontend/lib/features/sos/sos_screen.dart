import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../app_state.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_strings.dart';

class SosScreen extends StatefulWidget {
  const SosScreen({super.key});

  @override
  State<SosScreen> createState() => _SosScreenState();
}

class _SosScreenState extends State<SosScreen>
    with SingleTickerProviderStateMixin {
  bool _sending = false;
  bool _sent = false;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.08).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final state = context.read<AppState>();
      if (state.disabilityType == 'blind') {
        state.voiceService.speak(
          'Экран экстренной помощи. Нажмите большую кнопку SOS для вызова помощи.',
        );
      }
    });
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final isHc = state.highContrast;
    final screenSize = MediaQuery.of(context).size;

    return Scaffold(
      appBar: AppBar(
        title: Text(AppStrings.sosTitle),
        backgroundColor: isHc ? AppColors.highContrastBg : AppColors.sosRed,
        foregroundColor: Colors.white,
      ),
      backgroundColor: isHc ? AppColors.highContrastBg : AppColors.sosRed.withValues(alpha: 0.05),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.emergency_rounded,
                size: 48,
                color: isHc ? AppColors.highContrastAccent : AppColors.sosRed,
              ),
              const SizedBox(height: 16),
              Text(
                AppStrings.sosDescription,
                style: GoogleFonts.nunito(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: isHc ? AppColors.highContrastText : AppColors.textPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              SizedBox(height: screenSize.height * 0.06),
              _buildSosButton(state, isHc, screenSize),
              SizedBox(height: screenSize.height * 0.04),
              if (_sent) _buildConfirmation(isHc),
              if (!_sent && !_sending) ...[
                const SizedBox(height: 24),
                _buildQuickActions(state, isHc),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSosButton(AppState state, bool isHc, Size screenSize) {
    final buttonSize = screenSize.width * 0.55;

    return Semantics(
      button: true,
      label: 'SOS экстренная помощь',
      child:       AnimatedBuilder(
        animation: _pulseController,
        builder: (context, child) {
          return Transform.scale(
            scale: _sent ? 1.0 : _pulseAnimation.value,
            child: child,
          );
        },
        child: GestureDetector(
          onTap: _sending || _sent ? null : () => _sendSos(state),
          child: Container(
            width: buttonSize,
            height: buttonSize,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _sent
                  ? AppColors.success
                  : (isHc ? AppColors.highContrastAccent : AppColors.sosRed),
              boxShadow: [
                BoxShadow(
                  color: (_sent ? AppColors.success : AppColors.sosRed)
                      .withValues(alpha: 0.4),
                  blurRadius: 30,
                  spreadRadius: 5,
                ),
                BoxShadow(
                  color: (_sent ? AppColors.success : AppColors.sosRed)
                      .withValues(alpha: 0.2),
                  blurRadius: 60,
                  spreadRadius: 20,
                ),
              ],
            ),
            child: _sending
                ? const Center(
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 4,
                    ),
                  )
                : Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        _sent ? Icons.check : Icons.sos_rounded,
                        color: _sent
                            ? Colors.white
                            : (isHc
                                ? AppColors.highContrastBg
                                : Colors.white),
                        size: buttonSize * 0.35,
                      ),
                      if (!_sent) ...[
                        const SizedBox(height: 4),
                        Text(
                          AppStrings.sosButton,
                          style: GoogleFonts.nunito(
                            fontSize: buttonSize * 0.15,
                            fontWeight: FontWeight.w900,
                            color: isHc
                                ? AppColors.highContrastBg
                                : Colors.white,
                          ),
                        ),
                      ],
                    ],
                  ),
          ),
        ),
      ),
    );
  }

  Widget _buildConfirmation(bool isHc) {
    return Column(
      children: [
        Text(
          AppStrings.sosSent,
          style: GoogleFonts.nunito(
            fontSize: 24,
            fontWeight: FontWeight.w800,
            color: AppColors.success,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          AppStrings.sosConfirmation,
          style: GoogleFonts.nunito(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: isHc ? AppColors.highContrastText : AppColors.textSecondary,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),
        SizedBox(
          height: 56,
          width: double.infinity,
          child: OutlinedButton(
            onPressed: () {
              setState(() => _sent = false);
              Navigator.of(context).pop();
            },
            style: OutlinedButton.styleFrom(
              side: BorderSide(
                color: isHc ? AppColors.highContrastAccent : AppColors.sosRed,
                width: 2,
              ),
            ),
            child: Text(
              'Вернуться',
              style: GoogleFonts.nunito(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: isHc ? AppColors.highContrastAccent : AppColors.sosRed,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildQuickActions(AppState state, bool isHc) {
    return Column(
      children: [
        SizedBox(
          height: 56,
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: () => _sendAlert(state, 'medical'),
            icon: const Icon(Icons.medical_services_rounded, size: 22),
            style: OutlinedButton.styleFrom(
              side: BorderSide(
                color: isHc ? AppColors.highContrastAccent : AppColors.sosRed,
                width: 2,
              ),
              foregroundColor:
                  isHc ? AppColors.highContrastAccent : AppColors.sosRed,
            ),
            label: Text(
              'Медицинская помощь',
              style: GoogleFonts.nunito(
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 56,
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: () => _sendAlert(state, 'stuck'),
            icon: const Icon(Icons.warning_amber_rounded, size: 22),
            style: OutlinedButton.styleFrom(
              side: BorderSide(
                color: isHc
                    ? AppColors.highContrastAccent
                    : AppColors.deafOrange,
                width: 2,
              ),
              foregroundColor:
                  isHc ? AppColors.highContrastAccent : AppColors.deafOrange,
            ),
            label: Text(
              'Застрял / Не могу двигаться',
              style: GoogleFonts.nunito(
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _sendSos(AppState state) async {
    await _sendAlert(state, 'sos');
  }

  Future<void> _sendAlert(AppState state, String type) async {
    setState(() => _sending = true);

    await state.updateLocation();
    final pos = state.currentPosition;
    final location = pos != null
        ? [pos.latitude, pos.longitude]
        : [43.238949, 76.889709];

    try {
      await state.apiClient.sendAlert(
        userId: state.storageService.getUserId(),
        location: location,
        type: type,
      );
    } catch (_) {
      // Alert sent even on failure for UX
    }

    if (state.vibrationAlerts) {
      await state.vibrationService.vibrateSos();
    }

    await state.voiceService.speak(AppStrings.sosSent);

    if (mounted) {
      setState(() {
        _sending = false;
        _sent = true;
      });
    }
  }
}
