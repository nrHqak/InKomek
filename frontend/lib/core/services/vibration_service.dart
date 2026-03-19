import 'package:vibration/vibration.dart';

class VibrationService {
  Future<bool> get hasVibrator async => (await Vibration.hasVibrator()) == true;

  Future<void> vibrateSingle({int duration = 500}) async {
    if (await hasVibrator) {
      Vibration.vibrate(duration: duration);
    }
  }

  Future<void> vibratePattern(List<int> pattern) async {
    if (await hasVibrator) {
      Vibration.vibrate(pattern: pattern);
    }
  }

  Future<void> vibrateAlert() async {
    await vibratePattern([0, 200, 100, 200, 100, 400]);
  }

  Future<void> vibrateSos() async {
    await vibratePattern([
      0, 500, 200, 500, 200, 500,
      400,
      200, 200, 200, 200, 200,
      400,
      500, 200, 500, 200, 500,
    ]);
  }

  Future<void> vibrateConfirmation() async {
    await vibratePattern([0, 100, 50, 100]);
  }
}
