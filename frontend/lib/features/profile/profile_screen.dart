import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../app_state.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_strings.dart';
import '../../core/widgets/voice_fab.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late TextEditingController _nameController;
  String _selectedType = '';
  bool _saved = false;

  static const _disabilityTypes = {
    'wheelchair': AppStrings.wheelchair,
    'blind': AppStrings.blind,
    'elderly': AppStrings.elderly,
    'deaf': AppStrings.deaf,
    'other': AppStrings.other,
  };

  @override
  void initState() {
    super.initState();
    final state = context.read<AppState>();
    _nameController = TextEditingController(text: state.userName);
    _selectedType = state.disabilityType;
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final isHc = state.highContrast;

    return Scaffold(
      appBar: AppBar(
        title: Text(AppStrings.profileTitle),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildAvatar(state, isHc),
            const SizedBox(height: 28),
            _buildNameField(isHc),
            const SizedBox(height: 20),
            _buildDisabilitySelector(isHc),
            const SizedBox(height: 28),
            _buildSettingsSection(state, isHc),
            const SizedBox(height: 28),
            _buildSaveButton(state, isHc),
            if (_saved) ...[
              const SizedBox(height: 16),
              Center(
                child: Text(
                  AppStrings.profileSaved,
                  style: GoogleFonts.nunito(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.success,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 20),
          ],
        ),
      ),
      floatingActionButton: const VoiceFab(),
    );
  }

  Widget _buildAvatar(AppState state, bool isHc) {
    final typeColor = _getTypeColor(state.disabilityType);

    return Center(
      child: Column(
        children: [
          Container(
            width: 96,
            height: 96,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: typeColor.withValues(alpha: 0.15),
              border: Border.all(color: typeColor, width: 3),
            ),
            child: Icon(
              _getTypeIcon(state.disabilityType),
              size: 44,
              color: typeColor,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            state.userName.isEmpty ? AppStrings.appName : state.userName,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          if (state.disabilityType.isNotEmpty) ...[
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: typeColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(
                _disabilityTypes[state.disabilityType] ?? AppStrings.other,
                style: GoogleFonts.nunito(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: typeColor,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildNameField(bool isHc) {
    return Semantics(
      label: AppStrings.name,
      child: TextField(
        controller: _nameController,
        style: GoogleFonts.nunito(
          fontSize: 17,
          color: isHc ? AppColors.highContrastText : AppColors.textPrimary,
        ),
        decoration: InputDecoration(
          labelText: AppStrings.name,
          prefixIcon: Icon(
            Icons.person_outline,
            color: isHc ? AppColors.highContrastAccent : AppColors.brownLight,
          ),
        ),
      ),
    );
  }

  Widget _buildDisabilitySelector(bool isHc) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          AppStrings.disabilityType,
          style: GoogleFonts.nunito(
            fontSize: 17,
            fontWeight: FontWeight.w700,
            color: isHc ? AppColors.highContrastText : AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _disabilityTypes.entries.map((entry) {
            final selected = _selectedType == entry.key;
            final color = _getTypeColor(entry.key);

            return Semantics(
              selected: selected,
              label: entry.value,
              child: FilterChip(
                label: Text(
                  entry.value,
                  style: GoogleFonts.nunito(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: selected
                        ? Colors.white
                        : (isHc
                            ? AppColors.highContrastText
                            : AppColors.textPrimary),
                  ),
                ),
                selected: selected,
                selectedColor: color,
                backgroundColor:
                    isHc ? const Color(0xFF1A1A1A) : AppColors.surface,
                side: BorderSide(
                  color: selected
                      ? color
                      : (isHc
                          ? AppColors.highContrastAccent
                          : Colors.grey.shade300),
                ),
                showCheckmark: false,
                avatar: Icon(
                  _getTypeIcon(entry.key),
                  size: 18,
                  color: selected ? Colors.white : color,
                ),
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                onSelected: (_) {
                  setState(() => _selectedType = entry.key);
                },
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildSettingsSection(AppState state, bool isHc) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          AppStrings.settings,
          style: GoogleFonts.nunito(
            fontSize: 17,
            fontWeight: FontWeight.w700,
            color: isHc ? AppColors.highContrastText : AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 8),
        _settingTile(
          icon: Icons.mic,
          label: AppStrings.voiceControl,
          value: state.voiceControlEnabled,
          onChanged: (v) => state.setVoiceControl(v),
          isHc: isHc,
        ),
        _settingTile(
          icon: Icons.contrast,
          label: AppStrings.highContrast,
          value: state.highContrast,
          onChanged: (v) => state.setHighContrast(v),
          isHc: isHc,
        ),
        _settingTile(
          icon: Icons.text_fields,
          label: AppStrings.largeText,
          value: state.largeText,
          onChanged: (v) => state.setLargeText(v),
          isHc: isHc,
        ),
        _settingTile(
          icon: Icons.vibration,
          label: AppStrings.vibrationAlerts,
          value: state.vibrationAlerts,
          onChanged: (v) => state.setVibrationAlerts(v),
          isHc: isHc,
        ),
      ],
    );
  }

  Widget _settingTile({
    required IconData icon,
    required String label,
    required bool value,
    required ValueChanged<bool> onChanged,
    required bool isHc,
  }) {
    return Semantics(
      toggled: value,
      label: label,
      child: Container(
        margin: const EdgeInsets.only(bottom: 4),
        child: SwitchListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: 8),
          secondary: Icon(
            icon,
            color: isHc ? AppColors.highContrastAccent : AppColors.sunflowerDark,
            size: 24,
          ),
          title: Text(
            label,
            style: GoogleFonts.nunito(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: isHc ? AppColors.highContrastText : AppColors.textPrimary,
            ),
          ),
          value: value,
          activeThumbColor:
              isHc ? AppColors.highContrastAccent : AppColors.sunflowerDark,
          onChanged: onChanged,
        ),
      ),
    );
  }

  Widget _buildSaveButton(AppState state, bool isHc) {
    return SizedBox(
      height: 56,
      child: ElevatedButton.icon(
        onPressed: () => _saveProfile(state),
        icon: const Icon(Icons.save_rounded, size: 22),
        label: Text(
          AppStrings.saveProfile,
          style: GoogleFonts.nunito(
            fontSize: 18,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }

  Future<void> _saveProfile(AppState state) async {
    await state.setUserName(_nameController.text.trim());
    await state.setDisabilityType(_selectedType);

    if (state.vibrationAlerts) {
      state.vibrationService.vibrateConfirmation();
    }

    state.voiceService.speak(AppStrings.profileSaved);

    setState(() => _saved = true);
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) setState(() => _saved = false);
    });
  }

  Color _getTypeColor(String type) {
    switch (type) {
      case 'wheelchair':
        return AppColors.wheelchairBlue;
      case 'blind':
        return AppColors.blindPurple;
      case 'elderly':
        return AppColors.elderlyGreen;
      case 'deaf':
        return AppColors.deafOrange;
      default:
        return AppColors.otherTeal;
    }
  }

  IconData _getTypeIcon(String type) {
    switch (type) {
      case 'wheelchair':
        return Icons.accessible;
      case 'blind':
        return Icons.visibility_off;
      case 'elderly':
        return Icons.elderly;
      case 'deaf':
        return Icons.hearing_disabled;
      default:
        return Icons.person;
    }
  }
}
