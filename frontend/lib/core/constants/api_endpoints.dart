import 'package:flutter/foundation.dart';

class ApiEndpoints {
  ApiEndpoints._();

  static const String _mlBaseUrlFromEnv = String.fromEnvironment(
    'ML_API_BASE_URL',
    defaultValue: '',
  );
  static const String _authBaseUrlFromEnv = String.fromEnvironment(
    'AUTH_API_BASE_URL',
    defaultValue: '',
  );
  static const String _baseUrlFromEnv = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  static String _defaultBaseUrl(int port) {
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:$port';
    }
    return 'http://127.0.0.1:$port';
  }

  static String get mlBaseUrl {
    if (_mlBaseUrlFromEnv.isNotEmpty) return _mlBaseUrlFromEnv;
    if (_baseUrlFromEnv.isNotEmpty) return _baseUrlFromEnv;
    return _defaultBaseUrl(8000);
  }

  static String get authBaseUrl {
    if (_authBaseUrlFromEnv.isNotEmpty) return _authBaseUrlFromEnv;
    return _defaultBaseUrl(8002);
  }

  static const String navigate = '/navigate';
  static const String gpsCheck = '/gps/check';
  static const String alert = '/alert';
  static const String classify = '/classify';
  static const String health = '/health';

  static String full(String endpoint) => '$mlBaseUrl$endpoint';
}
