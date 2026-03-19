import 'dart:async';
import 'package:geolocator/geolocator.dart';

class LocationService {
  StreamSubscription<Position>? _positionStream;
  Position? _lastPosition;

  Position? get lastPosition => _lastPosition;

  Future<bool> requestPermission() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return false;

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return false;
    }

    if (permission == LocationPermission.deniedForever) return false;

    return true;
  }

  Future<Position?> getCurrentPosition() async {
    final hasPermission = await requestPermission();
    if (!hasPermission) return null;

    _lastPosition = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );
    return _lastPosition;
  }

  void startTracking({
    required void Function(Position position) onPosition,
    Duration interval = const Duration(seconds: 10),
  }) {
    _positionStream?.cancel();
    _positionStream = Geolocator.getPositionStream(
      locationSettings: AndroidSettings(
        accuracy: LocationAccuracy.high,
        intervalDuration: interval,
        distanceFilter: 5,
      ),
    ).listen((position) {
      _lastPosition = position;
      onPosition(position);
    });
  }

  void stopTracking() {
    _positionStream?.cancel();
    _positionStream = null;
  }

  double distanceBetween(
    double startLat,
    double startLng,
    double endLat,
    double endLng,
  ) {
    return Geolocator.distanceBetween(startLat, startLng, endLat, endLng);
  }

  void dispose() {
    stopTracking();
  }
}
