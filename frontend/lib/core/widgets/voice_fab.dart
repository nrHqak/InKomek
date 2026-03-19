import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../constants/app_colors.dart';
import '../constants/app_strings.dart';
import '../../app_state.dart';

class VoiceFab extends StatelessWidget {
  const VoiceFab({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AppState>(
      builder: (context, state, _) {
        if (!state.voiceControlEnabled) return const SizedBox.shrink();

        return Semantics(
          button: true,
          label: AppStrings.voiceCommand,
          child: FloatingActionButton(
            heroTag: 'voice_fab',
            onPressed: () => _toggleListening(context, state),
            backgroundColor: state.isListening
                ? AppColors.error
                : AppColors.sunflowerYellow,
            child: Icon(
              state.isListening ? Icons.mic : Icons.mic_none,
              color: state.isListening
                  ? Colors.white
                  : AppColors.brownDark,
              size: 28,
            ),
          ),
        );
      },
    );
  }

  void _toggleListening(BuildContext context, AppState state) {
    if (state.isListening) {
      state.stopListening();
    } else {
      state.startListening(
        onResult: (text) => _handleVoiceCommand(context, state, text),
      );
    }
  }

  void _handleVoiceCommand(
    BuildContext context,
    AppState state,
    String command,
  ) {
    final lower = command.toLowerCase().trim();

    if (lower.contains('карта') || lower.contains('map')) {
      Navigator.of(context).pushNamed('/map');
    } else if (lower.contains('репорт') || lower.contains('report')) {
      Navigator.of(context).pushNamed('/report');
    } else if (lower.contains('навигац') || lower.contains('маршрут') || lower.contains('путешеств')) {
      Navigator.of(context).pushNamed('/navigation');
    } else if (lower.contains('помощь') || lower.contains('sos') || lower.contains('help')) {
      Navigator.of(context).pushNamed('/sos');
    } else if (lower.contains('профиль') || lower.contains('profile') || lower.contains('настройк')) {
      Navigator.of(context).pushNamed('/profile');
    } else if (lower.contains('домой') || lower.contains('меню') || lower.contains('home')) {
      Navigator.of(context).pushNamedAndRemoveUntil('/home', (r) => false);
    } else {
      state.voiceService.speak('Команда не распознана. Попробуйте снова.');
    }
  }
}
