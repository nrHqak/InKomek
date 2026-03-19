class ApiEndpoints {
  ApiEndpoints._();

  static const String baseUrl = 'http://10.0.2.2:8000';

  static const String navigate = '/navigate';
  static const String gpsCheck = '/gps/check';
  static const String alert = '/alert';
  static const String classify = '/classify';
  static const String health = '/health';

  static String full(String endpoint) => '$baseUrl$endpoint';
}
