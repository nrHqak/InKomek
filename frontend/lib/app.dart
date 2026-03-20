import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'app_state.dart';
import 'core/theme/app_theme.dart';
import 'routing/app_router.dart';

class InKomekApp extends StatelessWidget {
  const InKomekApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AppState>(
      builder: (context, state, _) {
        final textScaleFactor = state.largeText ? 1.3 : 1.0;

        return MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.linear(textScaleFactor),
          ),
          child: MaterialApp(
            title: 'InKomek',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.light(highContrast: state.highContrast),
            initialRoute: state.isAuthenticated
                ? (state.isOnboardingComplete ? AppRouter.home : AppRouter.onboarding)
                : AppRouter.auth,
            onGenerateRoute: AppRouter.generateRoute,
          ),
        );
      },
    );
  }
}
