import 'package:dio/dio.dart';

import 'endpoints.dart';

class ApiClient {
  ApiClient({Dio? dio})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              baseUrl: kBackendBaseUrl,
              connectTimeout: const Duration(seconds: 6),
              receiveTimeout: const Duration(seconds: 12),
              sendTimeout: const Duration(seconds: 6),
              headers: const {'Accept': 'application/json'},
            ),
          );

  final Dio _dio;

  Future<Map<String, dynamic>> getJson(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    if (!isBackendConfigured) {
      throw StateError('Flix4U backend is not configured.');
    }
    final response = await _dio.get<Map<String, dynamic>>(
      path,
      queryParameters: query,
    );
    return response.data ?? <String, dynamic>{};
  }

  Future<Map<String, dynamic>> postJson(String path, {Object? data}) async {
    if (!isBackendConfigured) {
      throw StateError('Flix4U backend is not configured.');
    }
    final response = await _dio.post<Map<String, dynamic>>(path, data: data);
    return response.data ?? <String, dynamic>{};
  }

  Future<Map<String, dynamic>> health() => getJson(Endpoints.health);
}
