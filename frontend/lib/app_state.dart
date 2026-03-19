import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'core/services/api_client.dart';
import 'core/services/voice_service.dart';
import 'core/services/location_service.dart';
import 'core/services/storage_service.dart';
import 'core/services/vibration_service.dart';

class AppState extends ChangeNotifier {
  final ApiClient apiClient = ApiClient();
  final VoiceService voiceService = VoiceService();
  final LocationService locationService = LocationService();
  final StorageService storageService = StorageService();
  final VibrationService vibrationService = VibrationService();

  bool _initialized = false;
  bool _isListening = false;
  bool _highContrast = false;
  bool _largeText = false;
  bool _voiceControlEnabled = false;
  bool _vibrationAlerts = true;
  String _disabilityType = '';
  String _userName = '';
  Position? _currentPosition;
  Timer? _gpsTimer;
  final List<Map<String, dynamic>> _gpsBuffer = [];

  bool get initialized => _initialized;
  bool get isListening => _isListening;
  bool get highContrast => _highContrast;
  bool get largeText => _largeText;
  bool get voiceControlEnabled => _voiceControlEnabled;
  bool get vibrationAlerts => _vibrationAlerts;
  String get disabilityType => _disabilityType;
  String get userName => _userName;
  Position? get currentPosition => _currentPosition;

  Future<void> init() async {
    await storageService.init();
    await voiceService.init();

    _highContrast = storageService.isHighContrast();
    _largeText = storageService.isLargeText();
    _voiceControlEnabled = storageService.isVoiceControl();
    _vibrationAlerts = storageService.isVibrationAlerts();
    _disabilityType = storageService.getDisabilityType();
    _userName = storageService.getUserName();

    _initialized = true;
    notifyListeners();
  }

  Future<void> setDisabilityType(String type) async {
    _disabilityType = type;
    await storageService.setDisabilityType(type);
    notifyListeners();
  }

  Future<void> setUserName(String name) async {
    _userName = name;
    await storageService.setUserName(name);
    notifyListeners();
  }

  Future<void> setHighContrast(bool enabled) async {
    _highContrast = enabled;
    await storageService.setHighContrast(enabled);
    notifyListeners();
  }

  Future<void> setLargeText(bool enabled) async {
    _largeText = enabled;
    await storageService.setLargeText(enabled);
    notifyListeners();
  }

  Future<void> setVoiceControl(bool enabled) async {
    _voiceControlEnabled = enabled;
    await storageService.setVoiceControl(enabled);
    notifyListeners();
  }

  Future<void> setVibrationAlerts(bool enabled) async {
    _vibrationAlerts = enabled;
    await storageService.setVibrationAlerts(enabled);
    notifyListeners();
  }

  Future<void> completeOnboarding() async {
    await storageService.setOnboardingComplete(true);
    notifyListeners();
  }

  bool get isOnboardingComplete => storageService.isOnboardingComplete();

  Future<void> updateLocation() async {
    _currentPosition = await locationService.getCurrentPosition();
    notifyListeners();
  }

  void startGpsTracking() {
    _gpsBuffer.clear();
    locationService.startTracking(
      onPosition: (position) {
        _currentPosition = position;
        _gpsBuffer.add({
          'lat': position.latitude,
          'lon': position.longitude,
          'ts': DateTime.now().millisecondsSinceEpoch ~/ 1000,
        });

        if (_gpsBuffer.length >= 6) {
          _checkGpsAnomaly();
        }

        notifyListeners();
      },
    );
  }

  Future<void> _checkGpsAnomaly() async {
    try {
      final response = await apiClient.checkGps(
        userId: storageService.getUserId(),
        points: List.from(_gpsBuffer.take(6)),
      );

      if (response['is_anomaly'] == true && _vibrationAlerts) {
        vibrationService.vibrateAlert();
        voiceService.speak('Внимание! Обнаружена аномалия маршрута.');
      }

      if (_gpsBuffer.length > 6) {
        _gpsBuffer.removeRange(0, _gpsBuffer.length - 6);
      }
    } catch (e) {
      print('GPS anomaly check failed: $e');
    }
  }

  void stopGpsTracking() {
    locationService.stopTracking();
    _gpsTimer?.cancel();
    _gpsTimer = null;
    _gpsBuffer.clear();
  }

  void startListening({required void Function(String) onResult}) {
    _isListening = true;
    notifyListeners();
    voiceService.startListening(
      onResult: (text) {
        _isListening = false;
        notifyListeners();
        onResult(text);
      },
      onDone: () {
        _isListening = false;
        notifyListeners();
      },
    );
  }

  void stopListening() {
    voiceService.stopListening();
    _isListening = false;
    notifyListeners();
  }

  @override
  void dispose() {
    stopGpsTracking();
    voiceService.dispose();
    locationService.dispose();
    apiClient.dispose();
    super.dispose();
  }
}
