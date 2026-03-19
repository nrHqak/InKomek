import 'package:flutter/material.dart';
import '../features/onboarding/onboarding_screen.dart';
import '../features/home/home_screen.dart';
import '../features/map/map_screen.dart';
import '../features/report/report_screen.dart';
import '../features/navigation/navigation_screen.dart';
import '../features/sos/sos_screen.dart';
import '../features/profile/profile_screen.dart';

class AppRouter {
  static const String onboarding = '/onboarding';
  static const String home = '/home';
  static const String map = '/map';
  static const String report = '/report';
  static const String navigation = '/navigation';
  static const String sos = '/sos';
  static const String profile = '/profile';
  static const String videoAssistant = '/video-assistant';

  static Route<dynamic> generateRoute(RouteSettings settings) {
    switch (settings.name) {
      case onboarding:
        return _buildRoute(const OnboardingScreen(), settings);
      case home:
        return _buildRoute(const HomeScreen(), settings);
      case map:
        return _buildRoute(const MapScreen(), settings);
      case report:
        return _buildRoute(const ReportScreen(), settings);
      case navigation:
        return _buildRoute(const NavigationScreen(), settings);
      case sos:
        return _buildRoute(const SosScreen(), settings);
      case profile:
        return _buildRoute(const ProfileScreen(), settings);
      default:
        return _buildRoute(const HomeScreen(), settings);
    }
  }

  static MaterialPageRoute _buildRoute(Widget page, RouteSettings settings) {
    return MaterialPageRoute(
      builder: (_) => page,
      settings: settings,
    );
  }
}
