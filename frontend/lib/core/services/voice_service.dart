import 'package:flutter_tts/flutter_tts.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

class VoiceService {
  final FlutterTts _tts = FlutterTts();
  final stt.SpeechToText _stt = stt.SpeechToText();
  bool _sttInitialized = false;

  Future<void> init() async {
    await _tts.setLanguage('ru-RU');
    await _tts.setSpeechRate(0.45);
    await _tts.setVolume(1.0);
    await _tts.setPitch(1.0);
  }

  Future<void> speak(String text) async {
    await _tts.stop();
    await _tts.speak(text);
  }

  Future<void> stop() async {
    await _tts.stop();
  }

  Future<bool> initSpeechRecognition() async {
    if (_sttInitialized) return true;
    _sttInitialized = await _stt.initialize(
      onError: (error) => print('STT error: $error'),
    );
    return _sttInitialized;
  }

  Future<void> startListening({
    required void Function(String text) onResult,
    void Function()? onDone,
  }) async {
    if (!_sttInitialized) {
      final ready = await initSpeechRecognition();
      if (!ready) return;
    }

    await _stt.listen(
      onResult: (result) {
        if (result.finalResult) {
          onResult(result.recognizedWords);
          onDone?.call();
        }
      },
      localeId: 'ru_RU',
      listenOptions: stt.SpeechListenOptions(
        listenMode: stt.ListenMode.confirmation,
      ),
    );
  }

  Future<void> stopListening() async {
    await _stt.stop();
  }

  bool get isListening => _stt.isListening;

  void dispose() {
    _tts.stop();
    _stt.stop();
  }
}
