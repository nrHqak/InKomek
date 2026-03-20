import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class StorageService {
  late SharedPreferences _prefs;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  // User profile
  Future<void> setUserName(String name) =>
      _prefs.setString('user_name', name);

  String getUserName() => _prefs.getString('user_name') ?? '';

  Future<void> setDisabilityType(String type) =>
      _prefs.setString('disability_type', type);

  String getDisabilityType() =>
      _prefs.getString('disability_type') ?? '';

  Future<void> setOnboardingComplete(bool complete) =>
      _prefs.setBool('onboarding_complete', complete);

  bool isOnboardingComplete() =>
      _prefs.getBool('onboarding_complete') ?? false;

  // Settings
  Future<void> setHighContrast(bool enabled) =>
      _prefs.setBool('high_contrast', enabled);

  bool isHighContrast() => _prefs.getBool('high_contrast') ?? false;

  Future<void> setLargeText(bool enabled) =>
      _prefs.setBool('large_text', enabled);

  bool isLargeText() => _prefs.getBool('large_text') ?? false;

  Future<void> setVoiceControl(bool enabled) =>
      _prefs.setBool('voice_control', enabled);

  bool isVoiceControl() => _prefs.getBool('voice_control') ?? false;

  Future<void> setVibrationAlerts(bool enabled) =>
      _prefs.setBool('vibration_alerts', enabled);

  bool isVibrationAlerts() =>
      _prefs.getBool('vibration_alerts') ?? true;

  // Auth token
  Future<void> setAuthToken(String token) =>
      _prefs.setString('auth_token', token);

  String getAuthToken() => _prefs.getString('auth_token') ?? '';

  Future<void> clearAuthToken() => _prefs.remove('auth_token');

  // Offline route cache
  Future<void> cacheLastRoute(Map<String, dynamic> route) =>
      _prefs.setString('last_route', jsonEncode(route));

  Map<String, dynamic>? getLastRoute() {
    final raw = _prefs.getString('last_route');
    if (raw == null) return null;
    return jsonDecode(raw) as Map<String, dynamic>;
  }

  // User ID for API
  String getUserId() {
    var id = _prefs.getString('user_id');
    if (id == null) {
      id = 'user_${DateTime.now().millisecondsSinceEpoch}';
      _prefs.setString('user_id', id);
    }
    return id;
  }
}
