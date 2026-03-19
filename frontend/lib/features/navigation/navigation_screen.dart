import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../../app_state.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_strings.dart';
import '../../core/widgets/voice_fab.dart';

class NavigationScreen extends StatefulWidget {
  const NavigationScreen({super.key});

  @override
  State<NavigationScreen> createState() => _NavigationScreenState();
}

class _NavigationScreenState extends State<NavigationScreen> {
  final MapController _mapController = MapController();
  final TextEditingController _startController = TextEditingController();
  final TextEditingController _endController = TextEditingController();

  List<LatLng> _routePoints = [];
  bool _loading = false;
  bool _navigating = false;
  Map<String, dynamic>? _routeSummary;
  int _currentStep = 0;
  List<String> _instructions = [];

  @override
  void initState() {
    super.initState();
    _initStartLocation();
  }

  Future<void> _initStartLocation() async {
    final state = context.read<AppState>();
    await state.updateLocation();
    final pos = state.currentPosition;
    if (pos != null) {
      _startController.text =
          '${pos.latitude.toStringAsFixed(6)}, ${pos.longitude.toStringAsFixed(6)}';
    }
  }

  @override
  void dispose() {
    _startController.dispose();
    _endController.dispose();
    final state = context.read<AppState>();
    if (_navigating) {
      state.stopGpsTracking();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final isHc = state.highContrast;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          _navigating ? AppStrings.navigating : AppStrings.navigationTitle,
        ),
        actions: [
          if (_navigating)
            IconButton(
              icon: const Icon(Icons.stop_circle_outlined, size: 28),
              onPressed: () => _stopNavigation(state),
              tooltip: AppStrings.cancel,
            ),
        ],
      ),
      body: Column(
        children: [
          if (!_navigating) _buildInputPanel(state, isHc),
          Expanded(
            child: Stack(
              children: [
                FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: const LatLng(43.238949, 76.889709),
                    initialZoom: 14,
                  ),
                  children: [
                    TileLayer(
                      urlTemplate:
                          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.inkomek.app',
                    ),
                    if (_routePoints.isNotEmpty)
                      PolylineLayer(
                        polylines: [
                          Polyline(
                            points: _routePoints,
                            color: isHc
                                ? AppColors.highContrastAccent
                                : AppColors.wheelchairBlue,
                            strokeWidth: 5,
                          ),
                        ],
                      ),
                    MarkerLayer(
                      markers: [
                        if (state.currentPosition != null)
                          Marker(
                            point: LatLng(
                              state.currentPosition!.latitude,
                              state.currentPosition!.longitude,
                            ),
                            width: 40,
                            height: 40,
                            child: Container(
                              decoration: BoxDecoration(
                                color: AppColors.wheelchairBlue,
                                shape: BoxShape.circle,
                                border:
                                    Border.all(color: Colors.white, width: 3),
                              ),
                              child: const Icon(Icons.navigation,
                                  color: Colors.white, size: 20),
                            ),
                          ),
                        if (_routePoints.isNotEmpty) ...[
                          Marker(
                            point: _routePoints.first,
                            width: 36,
                            height: 36,
                            child: Container(
                              decoration: BoxDecoration(
                                color: AppColors.success,
                                shape: BoxShape.circle,
                                border:
                                    Border.all(color: Colors.white, width: 2),
                              ),
                              child: const Icon(Icons.play_arrow,
                                  color: Colors.white, size: 18),
                            ),
                          ),
                          Marker(
                            point: _routePoints.last,
                            width: 36,
                            height: 36,
                            child: Container(
                              decoration: BoxDecoration(
                                color: AppColors.error,
                                shape: BoxShape.circle,
                                border:
                                    Border.all(color: Colors.white, width: 2),
                              ),
                              child: const Icon(Icons.flag,
                                  color: Colors.white, size: 18),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
                if (_loading)
                  Container(
                    color: Colors.black26,
                    child: const Center(child: CircularProgressIndicator()),
                  ),
                if (_navigating && _instructions.isNotEmpty)
                  _buildInstructionOverlay(isHc),
              ],
            ),
          ),
          if (_routePoints.isNotEmpty && _routeSummary != null)
            _buildSummaryBar(state, isHc),
        ],
      ),
      floatingActionButton: const VoiceFab(),
    );
  }

  Widget _buildInputPanel(AppState state, bool isHc) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isHc ? const Color(0xFF1A1A1A) : AppColors.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          Semantics(
            label: AppStrings.startPoint,
            child: TextField(
              controller: _startController,
              style: GoogleFonts.nunito(fontSize: 15),
              decoration: InputDecoration(
                labelText: AppStrings.startPoint,
                prefixIcon: Icon(Icons.my_location,
                    color: AppColors.success, size: 22),
                suffixIcon: IconButton(
                  icon: Icon(Icons.gps_fixed,
                      color: isHc
                          ? AppColors.highContrastAccent
                          : AppColors.sunflowerDark),
                  onPressed: _initStartLocation,
                  tooltip: 'Использовать текущее местоположение',
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Semantics(
            label: AppStrings.endPoint,
            child: TextField(
              controller: _endController,
              style: GoogleFonts.nunito(fontSize: 15),
              decoration: InputDecoration(
                labelText: AppStrings.endPoint,
                prefixIcon:
                    Icon(Icons.flag, color: AppColors.error, size: 22),
                suffixIcon: IconButton(
                  icon: Icon(Icons.mic,
                      color: isHc
                          ? AppColors.highContrastAccent
                          : AppColors.sunflowerDark),
                  onPressed: () => _voiceInputEnd(state),
                  tooltip: 'Голосовой ввод',
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 56,
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _loading ? null : () => _buildRoute(state),
              icon: _loading
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2.5),
                    )
                  : const Icon(Icons.route, size: 22),
              label: Text(
                AppStrings.buildRoute,
                style: GoogleFonts.nunito(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInstructionOverlay(bool isHc) {
    if (_currentStep >= _instructions.length) return const SizedBox.shrink();

    return Positioned(
      top: 16,
      left: 16,
      right: 16,
      child: Card(
        color: isHc ? AppColors.highContrastBg : AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: isHc
              ? const BorderSide(color: AppColors.highContrastAccent, width: 2)
              : BorderSide.none,
        ),
        elevation: 4,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: isHc
                      ? AppColors.highContrastAccent
                      : AppColors.sunflowerYellow,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  Icons.navigation_rounded,
                  color: isHc ? AppColors.highContrastBg : AppColors.brownDark,
                  size: 26,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Шаг ${_currentStep + 1} из ${_instructions.length}',
                      style: GoogleFonts.nunito(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: isHc
                            ? AppColors.highContrastText
                            : AppColors.textSecondary,
                      ),
                    ),
                    Text(
                      _instructions[_currentStep],
                      style: GoogleFonts.nunito(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: isHc
                            ? AppColors.highContrastText
                            : AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: Icon(
                  Icons.skip_next_rounded,
                  size: 32,
                  color: isHc
                      ? AppColors.highContrastAccent
                      : AppColors.sunflowerDark,
                ),
                onPressed: _nextStep,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSummaryBar(AppState state, bool isHc) {
    final lengthM = (_routeSummary!['total_length_m'] as num?)?.toInt() ?? 0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isHc ? const Color(0xFF1A1A1A) : AppColors.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _summaryItem(
                Icons.straighten,
                '${lengthM}м',
                'Расстояние',
                isHc,
              ),
              _summaryItem(
                Icons.timer,
                '~${(lengthM / 60).ceil()} мин',
                'Время',
                isHc,
              ),
              _summaryItem(
                Icons.route,
                '${_routePoints.length}',
                'Точек',
                isHc,
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 56,
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _navigating
                  ? () => _stopNavigation(state)
                  : () => _startNavigation(state),
              style: ElevatedButton.styleFrom(
                backgroundColor: _navigating
                    ? AppColors.error
                    : (isHc
                        ? AppColors.highContrastAccent
                        : AppColors.sunflowerYellow),
                foregroundColor: _navigating
                    ? Colors.white
                    : (isHc
                        ? AppColors.highContrastBg
                        : AppColors.brownDark),
              ),
              icon: Icon(
                _navigating ? Icons.stop : Icons.navigation_rounded,
                size: 22,
              ),
              label: Text(
                _navigating ? 'Остановить' : AppStrings.startNavigation,
                style: GoogleFonts.nunito(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _summaryItem(IconData icon, String value, String label, bool isHc) {
    return Column(
      children: [
        Icon(
          icon,
          size: 24,
          color: isHc ? AppColors.highContrastAccent : AppColors.sunflowerDark,
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: GoogleFonts.nunito(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: isHc ? AppColors.highContrastText : AppColors.textPrimary,
          ),
        ),
        Text(
          label,
          style: GoogleFonts.nunito(
            fontSize: 13,
            color: isHc ? AppColors.highContrastText : AppColors.textSecondary,
          ),
        ),
      ],
    );
  }

  List<double>? _parseCoords(String text) {
    final parts = text.split(',').map((s) => s.trim()).toList();
    if (parts.length != 2) return null;
    final lat = double.tryParse(parts[0]);
    final lon = double.tryParse(parts[1]);
    if (lat == null || lon == null) return null;
    return [lat, lon];
  }

  Future<void> _buildRoute(AppState state) async {
    final startCoords = _parseCoords(_startController.text);
    final endCoords = _parseCoords(_endController.text);

    if (startCoords == null || endCoords == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Введите координаты в формате: 43.238, 76.889',
            style: GoogleFonts.nunito(fontSize: 15),
          ),
        ),
      );
      return;
    }

    setState(() => _loading = true);

    try {
      final response = await state.apiClient.navigate(
        userType: state.disabilityType.isEmpty
            ? 'wheelchair'
            : state.disabilityType,
        startCoords: startCoords,
        endCoords: endCoords,
      );

      final coords = response['route_coords'] as List<dynamic>;
      final routePoints = coords
          .map((c) => LatLng((c as List)[0].toDouble(), c[1].toDouble()))
          .toList();

      await state.storageService.cacheLastRoute(response);

      _generateInstructions(routePoints);

      setState(() {
        _routePoints = routePoints;
        _routeSummary = response['summary'] as Map<String, dynamic>?;
        _loading = false;
      });

      if (routePoints.isNotEmpty) {
        _mapController.move(routePoints.first, 15);
      }

      if (state.disabilityType == 'blind' && _routeSummary != null) {
        final length = (_routeSummary!['total_length_m'] as num).toInt();
        state.voiceService.speak(
          'Маршрут построен. Длина: $length метров. '
          'Нажмите "Начать навигацию" для голосовых инструкций.',
        );
      }
    } catch (e) {
      setState(() => _loading = false);

      final cached = state.storageService.getLastRoute();
      if (cached != null) {
        final coords = cached['route_coords'] as List<dynamic>;
        setState(() {
          _routePoints = coords
              .map((c) => LatLng((c as List)[0].toDouble(), c[1].toDouble()))
              .toList();
          _routeSummary = cached['summary'] as Map<String, dynamic>?;
        });
        _generateInstructions(_routePoints);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Загружен кэшированный маршрут')),
          );
        }
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${AppStrings.error}: $e')),
        );
      }
    }
  }

  void _generateInstructions(List<LatLng> points) {
    if (points.length < 2) return;

    final instructions = <String>['Начните движение'];
    const distance = Distance();

    for (int i = 1; i < points.length && i < 10; i++) {
      final prev = points[i - 1];
      final curr = points[i];
      final dist = distance.as(LengthUnit.Meter, prev, curr).toInt();
      final bearing = distance.bearing(prev, curr);
      final direction = _bearingToDirection(bearing);

      instructions.add('Двигайтесь $direction $dist метров');
    }

    instructions.add('Вы достигли пункта назначения');
    _instructions = instructions;
  }

  String _bearingToDirection(double bearing) {
    if (bearing >= 337.5 || bearing < 22.5) return 'на север';
    if (bearing >= 22.5 && bearing < 67.5) return 'на северо-восток';
    if (bearing >= 67.5 && bearing < 112.5) return 'на восток';
    if (bearing >= 112.5 && bearing < 157.5) return 'на юго-восток';
    if (bearing >= 157.5 && bearing < 202.5) return 'на юг';
    if (bearing >= 202.5 && bearing < 247.5) return 'на юго-запад';
    if (bearing >= 247.5 && bearing < 292.5) return 'на запад';
    return 'на северо-запад';
  }

  void _startNavigation(AppState state) {
    setState(() {
      _navigating = true;
      _currentStep = 0;
    });

    state.startGpsTracking();

    if (_instructions.isNotEmpty) {
      state.voiceService.speak(_instructions[0]);
    }

    if (state.vibrationAlerts) {
      state.vibrationService.vibrateConfirmation();
    }
  }

  void _stopNavigation(AppState state) {
    state.stopGpsTracking();
    setState(() => _navigating = false);
    state.voiceService.speak('Навигация остановлена');
  }

  void _nextStep() {
    final state = context.read<AppState>();
    if (_currentStep < _instructions.length - 1) {
      setState(() => _currentStep++);
      state.voiceService.speak(_instructions[_currentStep]);

      if (_currentStep < _routePoints.length) {
        _mapController.move(_routePoints[_currentStep], 17);
      }
    } else {
      state.voiceService.speak('Вы достигли пункта назначения');
      if (state.vibrationAlerts) {
        state.vibrationService.vibrateConfirmation();
      }
      _stopNavigation(state);
    }
  }

  void _voiceInputEnd(AppState state) {
    state.voiceService.speak('Назовите пункт назначения');
    state.startListening(
      onResult: (text) {
        _endController.text = text;
        state.voiceService.speak('Пункт назначения: $text');
      },
    );
  }
}
