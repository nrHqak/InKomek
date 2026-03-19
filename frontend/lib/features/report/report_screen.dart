import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../../app_state.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_strings.dart';
import '../../core/widgets/voice_fab.dart';

class ReportScreen extends StatefulWidget {
  const ReportScreen({super.key});

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  final TextEditingController _descController = TextEditingController();
  final ImagePicker _picker = ImagePicker();
  File? _selectedImage;
  bool _isAnalyzing = false;
  Map<String, dynamic>? _result;
  String? _errorMessage;

  @override
  void dispose() {
    _descController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final isHc = state.highContrast;

    return Scaffold(
      appBar: AppBar(
        title: Text(AppStrings.reportTitle),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildImageSection(isHc),
            const SizedBox(height: 20),
            _buildDescriptionField(isHc),
            const SizedBox(height: 20),
            _buildSendButton(state, isHc),
            if (_result != null) ...[
              const SizedBox(height: 24),
              _buildResultCard(isHc),
            ],
            if (_errorMessage != null) ...[
              const SizedBox(height: 24),
              _buildErrorCard(isHc),
            ],
          ],
        ),
      ),
      floatingActionButton: const VoiceFab(),
    );
  }

  Widget _buildImageSection(bool isHc) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_selectedImage != null) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Image.file(
              _selectedImage!,
              height: 220,
              width: double.infinity,
              fit: BoxFit.cover,
            ),
          ),
          const SizedBox(height: 12),
        ] else ...[
          Container(
            height: 200,
            decoration: BoxDecoration(
              color: isHc
                  ? const Color(0xFF1A1A1A)
                  : AppColors.surfaceVariant,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isHc
                    ? AppColors.highContrastAccent
                    : AppColors.brownLight.withValues(alpha: 0.3),
                width: 2,
                strokeAlign: BorderSide.strokeAlignInside,
              ),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.add_a_photo_rounded,
                  size: 48,
                  color: isHc
                      ? AppColors.highContrastAccent
                      : AppColors.brownLight,
                ),
                const SizedBox(height: 12),
                Text(
                  'Добавьте фото проблемы',
                  style: GoogleFonts.nunito(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: isHc
                        ? AppColors.highContrastText
                        : AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
        Row(
          children: [
            Expanded(
              child: SizedBox(
                height: 56,
                child: ElevatedButton.icon(
                  onPressed: _isAnalyzing ? null : _takePhoto,
                  icon: const Icon(Icons.camera_alt, size: 22),
                  label: Text(
                    AppStrings.takePhoto,
                    style: GoogleFonts.nunito(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: SizedBox(
                height: 56,
                child: OutlinedButton.icon(
                  onPressed: _isAnalyzing ? null : _pickFromGallery,
                  icon: const Icon(Icons.photo_library, size: 22),
                  label: Text(
                    AppStrings.chooseFromGallery,
                    style: GoogleFonts.nunito(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildDescriptionField(bool isHc) {
    return Semantics(
      label: AppStrings.describeIssue,
      child: TextField(
        controller: _descController,
        maxLines: 4,
        style: GoogleFonts.nunito(
          fontSize: 16,
          color: isHc ? AppColors.highContrastText : AppColors.textPrimary,
        ),
        decoration: InputDecoration(
          labelText: AppStrings.describeIssue,
          alignLabelWithHint: true,
          suffixIcon: IconButton(
            icon: Icon(
              Icons.mic,
              color: isHc
                  ? AppColors.highContrastAccent
                  : AppColors.sunflowerDark,
            ),
            onPressed: () => _voiceInput(context),
            tooltip: 'Голосовой ввод',
          ),
        ),
      ),
    );
  }

  Widget _buildSendButton(AppState state, bool isHc) {
    return SizedBox(
      height: 56,
      child: ElevatedButton.icon(
        onPressed: (_selectedImage == null || _isAnalyzing)
            ? null
            : () => _sendReport(state),
        icon: _isAnalyzing
            ? SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  color: isHc ? AppColors.highContrastBg : AppColors.brownDark,
                ),
              )
            : const Icon(Icons.send_rounded, size: 22),
        label: Text(
          _isAnalyzing ? AppStrings.analyzing : AppStrings.sendReport,
          style: GoogleFonts.nunito(
            fontSize: 18,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }

  Widget _buildResultCard(bool isHc) {
    return Card(
      color: isHc
          ? const Color(0xFF1A1A1A)
          : AppColors.success.withValues(alpha: 0.05),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: isHc ? AppColors.highContrastAccent : AppColors.success,
          width: 1.5,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.check_circle,
                  color: isHc ? AppColors.highContrastAccent : AppColors.success,
                  size: 28,
                ),
                const SizedBox(width: 12),
                Text(
                  AppStrings.reportSent,
                  style: GoogleFonts.nunito(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: isHc
                        ? AppColors.highContrastText
                        : AppColors.textPrimary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _resultRow('Категория', _result!['category']?.toString() ?? '-'),
            _resultRow(
              'Уверенность',
              '${((_result!['confidence'] as num? ?? 0) * 100).toStringAsFixed(1)}%',
            ),
            if (_result!['description'] != null)
              _resultRow('Описание', _result!['description'].toString()),
          ],
        ),
      ),
    );
  }

  Widget _resultRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              '$label:',
              style: GoogleFonts.nunito(
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: GoogleFonts.nunito(fontSize: 15),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorCard(bool isHc) {
    return Card(
      color: isHc
          ? const Color(0xFF1A1A1A)
          : AppColors.error.withValues(alpha: 0.05),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: isHc ? AppColors.highContrastAccent : AppColors.error,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(Icons.error_outline, color: AppColors.error, size: 28),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                _errorMessage!,
                style: GoogleFonts.nunito(fontSize: 15),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _takePhoto() async {
    final image = await _picker.pickImage(
      source: ImageSource.camera,
      maxWidth: 1920,
      maxHeight: 1080,
      imageQuality: 85,
    );
    if (image != null) {
      setState(() {
        _selectedImage = File(image.path);
        _result = null;
        _errorMessage = null;
      });
    }
  }

  Future<void> _pickFromGallery() async {
    final image = await _picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1920,
      maxHeight: 1080,
      imageQuality: 85,
    );
    if (image != null) {
      setState(() {
        _selectedImage = File(image.path);
        _result = null;
        _errorMessage = null;
      });
    }
  }

  void _voiceInput(BuildContext context) {
    final state = context.read<AppState>();
    state.voiceService.speak('Опишите проблему голосом');
    state.startListening(
      onResult: (text) {
        _descController.text = text;
        state.voiceService.speak('Записано: $text');
      },
    );
  }

  Future<void> _sendReport(AppState state) async {
    if (_selectedImage == null) return;

    setState(() {
      _isAnalyzing = true;
      _result = null;
      _errorMessage = null;
    });

    try {
      final result = await state.apiClient.classifyImage(_selectedImage!);

      setState(() {
        _result = result;
        _isAnalyzing = false;
      });

      if (state.vibrationAlerts) {
        state.vibrationService.vibrateConfirmation();
      }

      if (state.disabilityType == 'blind') {
        state.voiceService.speak(
          'Анализ завершён. Категория: ${result['category']}. '
          'Уверенность: ${((result['confidence'] as num) * 100).toStringAsFixed(0)} процентов.',
        );
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Не удалось отправить: $e';
        _isAnalyzing = false;
      });
    }
  }
}
