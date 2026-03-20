import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../constants/api_endpoints.dart';

class ApiClient {
  final http.Client _client;
  final String _mlBaseUrl;
  final String _authBaseUrl;
  String? _authToken;

  ApiClient({http.Client? client, String? mlBaseUrl, String? authBaseUrl})
      : _client = client ?? http.Client(),
        _mlBaseUrl = mlBaseUrl ?? ApiEndpoints.mlBaseUrl,
        _authBaseUrl = authBaseUrl ?? ApiEndpoints.authBaseUrl;

  void setAuthToken(String? token) {
    _authToken = token;
  }

  Map<String, String> _headers({Map<String, String>? extra}) {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (_authToken != null && _authToken!.isNotEmpty) {
      headers['Authorization'] = 'Bearer $_authToken';
    }
    if (extra != null) {
      headers.addAll(extra);
    }
    return headers;
  }

  Future<Map<String, dynamic>> register({
    required String name,
    required String email,
    required String password,
    required String typeOfDisability,
  }) async {
    final response = await _postAuth('/register', {
      'name': name,
      'email': email,
      'password': password,
      'type_of_disability': typeOfDisability,
    });
    return response;
  }

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final response = await _postAuth('/login', {
      'email': email,
      'password': password,
    });
    return response;
  }

  Future<Map<String, dynamic>> me() async {
    final uri = Uri.parse('$_authBaseUrl/me');
    final response = await _client.get(
      uri,
      headers: _headers(extra: const {'Accept': 'application/json'}),
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    }
    throw ApiException(response.statusCode, response.body);
  }

  Future<Map<String, dynamic>> navigate({
    required String userType,
    required List<double> startCoords,
    required List<double> endCoords,
  }) async {
    final response = await _post(ApiEndpoints.navigate, {
      'user_type': userType,
      'start_coords': startCoords,
      'end_coords': endCoords,
    });
    return response;
  }

  Future<Map<String, dynamic>> checkGps({
    required String userId,
    required List<Map<String, dynamic>> points,
  }) async {
    final response = await _post(ApiEndpoints.gpsCheck, {
      'user_id': userId,
      'points': points,
    });
    return response;
  }

  Future<Map<String, dynamic>> sendAlert({
    required String userId,
    required List<double> location,
    required String type,
  }) async {
    final response = await _post(ApiEndpoints.alert, {
      'user_id': userId,
      'location': location,
      'type': type,
    });
    return response;
  }

  Future<Map<String, dynamic>> classifyImage(File imageFile) async {
    final uri = Uri.parse('$_mlBaseUrl${ApiEndpoints.classify}');
    final request = http.MultipartRequest('POST', uri);
    if (_authToken != null && _authToken!.isNotEmpty) {
      request.headers['Authorization'] = 'Bearer $_authToken';
    }

    final extension = imageFile.path.split('.').last.toLowerCase();
    final mimeType = extension == 'png' ? 'image/png' : 'image/jpeg';

    request.files.add(await http.MultipartFile.fromPath(
      'image',
      imageFile.path,
      contentType: MediaType.parse(mimeType),
    ));

    final streamResponse = await _client.send(request);
    final response = await http.Response.fromStream(streamResponse);

    if (response.statusCode == 200) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    }
    throw ApiException(response.statusCode, response.body);
  }

  Future<bool> healthCheck() async {
    try {
      final uri = Uri.parse('$_mlBaseUrl${ApiEndpoints.health}');
      final response = await _client.get(uri).timeout(
        const Duration(seconds: 5),
      );
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<Map<String, dynamic>> _post(
    String endpoint,
    Map<String, dynamic> body,
  ) async {
    final uri = Uri.parse('$_mlBaseUrl$endpoint');
    final response = await _client.post(
      uri,
      headers: _headers(),
      body: jsonEncode(body),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    }
    throw ApiException(response.statusCode, response.body);
  }

  Future<Map<String, dynamic>> _postAuth(
    String endpoint,
    Map<String, dynamic> body,
  ) async {
    final uri = Uri.parse('$_authBaseUrl$endpoint');
    final response = await _client.post(
      uri,
      headers: _headers(),
      body: jsonEncode(body),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    }
    throw ApiException(response.statusCode, response.body);
  }

  void dispose() {
    _client.close();
  }
}

class ApiException implements Exception {
  final int statusCode;
  final String body;

  const ApiException(this.statusCode, this.body);

  @override
  String toString() => 'ApiException($statusCode): $body';
}
