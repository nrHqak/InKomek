import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../app_state.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_strings.dart';
import '../../core/widgets/accessible_button.dart';
import '../../core/widgets/voice_fab.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _animController.forward();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final state = context.read<AppState>();
      if (state.disabilityType == 'blind') {
        state.voiceService.speak(
          'Главное меню. Доступны: Карта, Репорт, Режим путешествия, Запрос помощи, Видео-ассистент.',
        );
      }
    });
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final isHc = state.highContrast;

    return Scaffold(
      appBar: AppBar(
        title: Text(AppStrings.appName),
        actions: [
          IconButton(
            icon: const Icon(Icons.person, size: 28),
            onPressed: () => Navigator.of(context).pushNamed('/profile'),
            tooltip: AppStrings.profileTitle,
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildHeader(state, isHc),
              const SizedBox(height: 24),
              Expanded(
                child: _buildMenuGrid(state, isHc),
              ),
            ],
          ),
        ),
      ),
      floatingActionButton: const VoiceFab(),
    );
  }

  Widget _buildHeader(AppState state, bool isHc) {
    final greeting = state.userName.isNotEmpty
        ? 'Привет, ${state.userName}!'
        : AppStrings.appTagline;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isHc
                    ? AppColors.highContrastBg
                    : AppColors.sunflowerYellow.withValues(alpha: 0.2),
                border: isHc
                    ? Border.all(color: AppColors.highContrastAccent)
                    : null,
              ),
              child: ClipOval(
                child: Image.asset(
                  'assets/images/logo.png',
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Icon(
                    Icons.local_florist,
                    color: isHc
                        ? AppColors.highContrastAccent
                        : AppColors.sunflowerDark,
                    size: 24,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                greeting,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
            ),
          ],
        ),
        if (state.disabilityType.isNotEmpty) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: _getTypeColor(state.disabilityType).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: _getTypeColor(state.disabilityType).withValues(alpha: 0.3),
              ),
            ),
            child: Text(
              _getTypeLabel(state.disabilityType),
              style: GoogleFonts.nunito(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: _getTypeColor(state.disabilityType),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildMenuGrid(AppState state, bool isHc) {
    final items = [
      _MenuItem(
        label: AppStrings.map,
        icon: Icons.map_rounded,
        route: '/map',
        color: isHc ? AppColors.highContrastAccent : AppColors.sunflowerYellow,
      ),
      _MenuItem(
        label: AppStrings.report,
        icon: Icons.camera_alt_rounded,
        route: '/report',
        color: isHc ? AppColors.highContrastAccent : AppColors.sunflowerYellow,
      ),
      _MenuItem(
        label: AppStrings.travelMode,
        icon: Icons.navigation_rounded,
        route: '/navigation',
        color: isHc ? AppColors.highContrastAccent : AppColors.sunflowerYellow,
      ),
      _MenuItem(
        label: AppStrings.requestHelp,
        icon: Icons.sos_rounded,
        route: '/sos',
        color: isHc ? AppColors.highContrastAccent : AppColors.sosRed,
      ),
      _MenuItem(
        label: AppStrings.videoAssistant,
        icon: Icons.videocam_rounded,
        route: '/video-assistant',
        color: isHc ? AppColors.highContrastAccent : AppColors.sunflowerYellow,
      ),
    ];

    return ListView.separated(
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 14),
      itemBuilder: (context, index) {
        final item = items[index];
        return SlideTransition(
          position: Tween<Offset>(
            begin: Offset(0, 0.3 + index * 0.1),
            end: Offset.zero,
          ).animate(CurvedAnimation(
            parent: _animController,
            curve: Interval(
              index * 0.1,
              0.6 + index * 0.08,
              curve: Curves.easeOutCubic,
            ),
          )),
          child: FadeTransition(
            opacity: CurvedAnimation(
              parent: _animController,
              curve: Interval(index * 0.1, 0.6 + index * 0.08),
            ),
            child: AccessibleButton(
              label: item.label,
              icon: item.icon,
              backgroundColor: item.label == AppStrings.requestHelp
                  ? (isHc ? AppColors.highContrastAccent : AppColors.sosRed)
                  : item.color,
              foregroundColor: item.label == AppStrings.requestHelp
                  ? (isHc ? AppColors.highContrastBg : Colors.white)
                  : (isHc ? AppColors.highContrastBg : AppColors.brownDark),
              onPressed: () {
                if (item.route == '/video-assistant') {
                  _showVideoAssistant(context);
                } else {
                  Navigator.of(context).pushNamed(item.route);
                }
              },
            ),
          ),
        );
      },
    );
  }

  void _showVideoAssistant(BuildContext context) {
    final state = context.read<AppState>();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(24),
        height: MediaQuery.of(ctx).size.height * 0.4,
        child: Column(
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 24),
            Icon(
              Icons.videocam_rounded,
              size: 64,
              color: state.highContrast
                  ? AppColors.highContrastAccent
                  : AppColors.sunflowerDark,
            ),
            const SizedBox(height: 16),
            Text(
              AppStrings.videoAssistant,
              style: Theme.of(ctx).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(
              'Видео-ассистент скоро будет доступен. Эта функция позволит получить помощь через видеозвонок.',
              style: Theme.of(ctx).textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text(AppStrings.ok),
              ),
            ),
          ],
        ),
      ),
    );
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

  String _getTypeLabel(String type) {
    switch (type) {
      case 'wheelchair':
        return AppStrings.wheelchair;
      case 'blind':
        return AppStrings.blind;
      case 'elderly':
        return AppStrings.elderly;
      case 'deaf':
        return AppStrings.deaf;
      default:
        return AppStrings.other;
    }
  }
}

class _MenuItem {
  final String label;
  final IconData icon;
  final String route;
  final Color color;

  const _MenuItem({
    required this.label,
    required this.icon,
    required this.route,
    required this.color,
  });
}
