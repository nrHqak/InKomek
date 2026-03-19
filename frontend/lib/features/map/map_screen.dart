import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../../app_state.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_strings.dart';
import '../../core/widgets/voice_fab.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final MapController _mapController = MapController();
  LatLng _center = const LatLng(43.238949, 76.889709);
  List<LatLng> _routePoints = [];
  final List<_ProblemPin> _problemPins = [];
  bool _loading = false;
  bool _showLegend = false;

  static const _defaultProblemPins = [
    _ProblemPin(
      position: LatLng(43.240, 76.891),
      type: 'high_curb',
      label: 'Высокий бордюр',
    ),
    _ProblemPin(
      position: LatLng(43.242, 76.895),
      type: 'no_ramp',
      label: 'Нет пандуса',
    ),
    _ProblemPin(
      position: LatLng(43.244, 76.900),
      type: 'broken_surface',
      label: 'Повреждённое покрытие',
    ),
  ];

  @override
  void initState() {
    super.initState();
    _problemPins.addAll(_defaultProblemPins);
    _initLocation();
  }

  Future<void> _initLocation() async {
    final state = context.read<AppState>();
    await state.updateLocation();
    final pos = state.currentPosition;
    if (pos != null && mounted) {
      setState(() {
        _center = LatLng(pos.latitude, pos.longitude);
      });
      _mapController.move(_center, 15);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final isHc = state.highContrast;

    return Scaffold(
      appBar: AppBar(
        title: Text(AppStrings.mapTitle),
        actions: [
          IconButton(
            icon: Icon(
              _showLegend ? Icons.info : Icons.info_outline,
              size: 28,
            ),
            onPressed: () => setState(() => _showLegend = !_showLegend),
            tooltip: 'Легенда',
          ),
          IconButton(
            icon: const Icon(Icons.my_location, size: 28),
            onPressed: _initLocation,
            tooltip: AppStrings.yourLocation,
          ),
        ],
      ),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _center,
              initialZoom: 15,
              onTap: (_, latLng) {
                if (state.disabilityType == 'blind') {
                  state.voiceService.speak(
                    'Координаты: ${latLng.latitude.toStringAsFixed(4)}, ${latLng.longitude.toStringAsFixed(4)}',
                  );
                }
              },
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
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
                          border: Border.all(color: Colors.white, width: 3),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.wheelchairBlue.withValues(alpha: 0.4),
                              blurRadius: 10,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.person_pin,
                          color: Colors.white,
                          size: 22,
                        ),
                      ),
                    ),
                  ..._problemPins.map(
                    (pin) => Marker(
                      point: pin.position,
                      width: 40,
                      height: 40,
                      child: GestureDetector(
                        onTap: () => _showPinDetails(pin),
                        child: Container(
                          decoration: BoxDecoration(
                            color: AppColors.error,
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 2),
                          ),
                          child: const Icon(
                            Icons.warning_rounded,
                            color: Colors.white,
                            size: 20,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
          if (_loading)
            Container(
              color: Colors.black26,
              child: const Center(child: CircularProgressIndicator()),
            ),
          if (_showLegend) _buildLegend(isHc),
          Positioned(
            bottom: 16,
            left: 16,
            right: 16,
            child: _buildBottomControls(state, isHc),
          ),
        ],
      ),
      floatingActionButton: const VoiceFab(),
      floatingActionButtonLocation: FloatingActionButtonLocation.miniStartFloat,
    );
  }

  Widget _buildLegend(bool isHc) {
    return Positioned(
      top: 8,
      right: 8,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Легенда',
                style: GoogleFonts.nunito(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              _legendItem(
                Icons.person_pin,
                AppColors.wheelchairBlue,
                AppStrings.yourLocation,
              ),
              _legendItem(
                Icons.warning_rounded,
                AppColors.error,
                AppStrings.problemPins,
              ),
              _legendItem(
                Icons.timeline,
                isHc ? AppColors.highContrastAccent : AppColors.wheelchairBlue,
                AppStrings.accessibleRoute,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _legendItem(IconData icon, Color color, String label) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 8),
          Text(
            label,
            style: GoogleFonts.nunito(fontSize: 14),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomControls(AppState state, bool isHc) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Expanded(
              child: SizedBox(
                height: 56,
                child: ElevatedButton.icon(
                  onPressed: _loading ? null : () => _loadRoute(state),
                  icon: const Icon(Icons.route, size: 24),
                  label: Text(
                    AppStrings.buildRoute,
                    style: GoogleFonts.nunito(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            SizedBox(
              height: 56,
              width: 56,
              child: ElevatedButton(
                onPressed: () => Navigator.of(context).pushNamed('/report'),
                style: ElevatedButton.styleFrom(
                  padding: EdgeInsets.zero,
                  backgroundColor: isHc
                      ? AppColors.highContrastAccent
                      : AppColors.sunflowerDark,
                ),
                child: Icon(
                  Icons.camera_alt,
                  color: isHc ? AppColors.highContrastBg : AppColors.brownDark,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _loadRoute(AppState state) async {
    if (state.currentPosition == null) {
      await _initLocation();
      if (state.currentPosition == null) return;
    }

    setState(() => _loading = true);

    try {
      final start = [
        state.currentPosition!.latitude,
        state.currentPosition!.longitude,
      ];
      final end = [43.246998, 76.923778];

      final response = await state.apiClient.navigate(
        userType: state.disabilityType.isEmpty ? 'wheelchair' : state.disabilityType,
        startCoords: start,
        endCoords: end,
      );

      final coords = response['route_coords'] as List<dynamic>;
      final routePoints = coords
          .map((c) => LatLng((c as List)[0].toDouble(), c[1].toDouble()))
          .toList();

      await state.storageService.cacheLastRoute(response);

      setState(() {
        _routePoints = routePoints;
        _loading = false;
      });

      if (routePoints.isNotEmpty) {
        _mapController.move(routePoints.first, 15);
      }

      if (state.disabilityType == 'blind') {
        final summary = response['summary'];
        state.voiceService.speak(
          'Маршрут построен. Длина: ${(summary['total_length_m'] as num).toInt()} метров.',
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
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Загружен кэшированный маршрут')),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('${AppStrings.error}: $e')),
          );
        }
      }
    }
  }

  void _showPinDetails(_ProblemPin pin) {
    final state = context.read<AppState>();

    if (state.disabilityType == 'blind') {
      state.voiceService.speak('Проблема: ${pin.label}');
    }

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            Icon(Icons.warning_rounded, color: AppColors.error, size: 48),
            const SizedBox(height: 12),
            Text(
              pin.label,
              style: Theme.of(ctx).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(
              'Тип: ${pin.type}',
              style: Theme.of(ctx).textTheme.bodyLarge,
            ),
            Text(
              'Координаты: ${pin.position.latitude.toStringAsFixed(4)}, ${pin.position.longitude.toStringAsFixed(4)}',
              style: Theme.of(ctx).textTheme.bodyMedium,
            ),
            const SizedBox(height: 20),
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
}

class _ProblemPin {
  final LatLng position;
  final String type;
  final String label;

  const _ProblemPin({
    required this.position,
    required this.type,
    required this.label,
  });
}
