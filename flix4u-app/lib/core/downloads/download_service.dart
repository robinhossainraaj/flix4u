import 'dart:io';

import 'package:dio/dio.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:path_provider/path_provider.dart';

import '../../data/models/media_item.dart';
import '../../data/models/stream_source.dart';

class DownloadRecord {
  const DownloadRecord({
    required this.id,
    required this.title,
    required this.url,
    required this.path,
    required this.referer,
    required this.quality,
    required this.language,
    required this.status,
    required this.progress,
    required this.received,
    required this.total,
    required this.createdAt,
    required this.itemJson,
    required this.sourceJson,
    this.error = '',
  });

  final String id;
  final String title;
  final String url;
  final String path;
  final String referer;
  final String quality;
  final String language;
  final String status;
  final double progress;
  final int received;
  final int total;
  final int createdAt;
  final Map<String, dynamic> itemJson;
  final Map<String, dynamic> sourceJson;
  final String error;

  bool get isDownloading => status == 'downloading';
  bool get isDone => status == 'done';
  bool get isFailed => status == 'failed';

  MediaItem get media => MediaItem.fromJson(itemJson);

  StreamOption get option => StreamOption.fromJson(sourceJson);

  factory DownloadRecord.fromJson(Map<String, dynamic> json) {
    return DownloadRecord(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? 'Untitled').toString(),
      url: (json['url'] ?? '').toString(),
      path: (json['path'] ?? '').toString(),
      referer: (json['referer'] ?? '').toString(),
      quality: (json['quality'] ?? 'Auto').toString(),
      language: (json['language'] ?? 'Original').toString(),
      status: (json['status'] ?? 'failed').toString(),
      progress: json['progress'] is num
          ? (json['progress'] as num).toDouble()
          : 0,
      received: json['received'] is num ? (json['received'] as num).toInt() : 0,
      total: json['total'] is num ? (json['total'] as num).toInt() : 0,
      createdAt: json['createdAt'] is num
          ? (json['createdAt'] as num).toInt()
          : 0,
      itemJson: json['itemJson'] is Map
          ? (json['itemJson'] as Map).cast<String, dynamic>()
          : <String, dynamic>{},
      sourceJson: json['sourceJson'] is Map
          ? (json['sourceJson'] as Map).cast<String, dynamic>()
          : <String, dynamic>{},
      error: (json['error'] ?? '').toString(),
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'title': title,
    'url': url,
    'path': path,
    'referer': referer,
    'quality': quality,
    'language': language,
    'status': status,
    'progress': progress,
    'received': received,
    'total': total,
    'createdAt': createdAt,
    'itemJson': itemJson,
    'sourceJson': sourceJson,
    'error': error,
  };

  DownloadRecord copyWith({
    String? status,
    double? progress,
    int? received,
    int? total,
    String? path,
    String? error,
  }) {
    return DownloadRecord(
      id: id,
      title: title,
      url: url,
      path: path ?? this.path,
      referer: referer,
      quality: quality,
      language: language,
      status: status ?? this.status,
      progress: progress ?? this.progress,
      received: received ?? this.received,
      total: total ?? this.total,
      createdAt: createdAt,
      itemJson: itemJson,
      sourceJson: sourceJson,
      error: error ?? this.error,
    );
  }
}

class DownloadService {
  DownloadService._();

  static final DownloadService instance = DownloadService._();
  static final Dio _dio = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 12),
      receiveTimeout: const Duration(seconds: 40),
      followRedirects: true,
    ),
  );
  static final Map<String, CancelToken> _tokens = <String, CancelToken>{};

  static Box get _box => Hive.box('downloads');

  static String idFor(String itemId, String url) {
    return '${itemId.hashCode.abs()}_${url.hashCode.abs()}';
  }

  static List<DownloadRecord> records() {
    final result = _box.values
        .whereType<Map>()
        .map(
          (value) => DownloadRecord.fromJson(value.cast<String, dynamic>()),
        )
        .toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return result;
  }

  static DownloadRecord? find(String id) {
    final value = _box.get(id);
    if (value is! Map) return null;
    return DownloadRecord.fromJson(value.cast<String, dynamic>());
  }

  static Future<void> start(
    MediaItem item,
    StreamOption option, {
    String? referer,
  }) async {
    if (!option.isValid) {
      throw const FormatException('This resource has no downloadable URL.');
    }
    final id = idFor(item.id, option.url);
    final existing = find(id);
    if (existing?.isDone == true) {
      throw StateError('Already downloaded. Open it from Downloads.');
    }
    if (existing?.isDownloading == true) {
      throw StateError('This download is already running.');
    }

    final directory = await getApplicationDocumentsDirectory();
    final target = Directory('${directory.path}${Platform.pathSeparator}flix4u_downloads');
    if (!target.existsSync()) await target.create(recursive: true);

    final extension = _extension(option.url, option.type);
    final path =
        '${target.path}${Platform.pathSeparator}$id$extension';
    final file = File(path);
    if (file.existsSync()) await file.delete();

    final record = DownloadRecord(
      id: id,
      title: item.title,
      url: option.url,
      path: path,
      referer: referer ?? '',
      quality: option.quality,
      language: option.language,
      status: 'downloading',
      progress: 0,
      received: 0,
      total: 0,
      createdAt: DateTime.now().millisecondsSinceEpoch,
      itemJson: item.toJson(),
      sourceJson: option.toJson(),
    );
    await _box.put(id, record.toJson());

    final token = CancelToken();
    _tokens[id] = token;
    var lastPercent = -1;
    try {
      await _dio.download(
        option.url,
        path,
        cancelToken: token,
        options: Options(
          headers: <String, dynamic>{
            if (referer != null && referer.isNotEmpty) 'Referer': referer,
            'User-Agent': 'Mozilla/5.0 (Linux; Android; Flix4U)',
          },
        ),
        onReceiveProgress: (received, total) {
          final percent = total > 0
              ? (received / total * 100).round()
              : (received / 1048576).round();
          if (percent == lastPercent) return;
          lastPercent = percent;
          final current = find(id);
          if (current == null) return;
          _box.put(
            id,
            current
                .copyWith(
                  status: 'downloading',
                  progress: total > 0 ? received / total : 0,
                  received: received,
                  total: total,
                )
                .toJson(),
          );
        },
      );
      final current = find(id);
      if (current != null) {
        await _box.put(
          id,
          current
              .copyWith(
                status: 'done',
                progress: 1,
                received: current.total > 0 ? current.total : current.received,
              )
              .toJson(),
        );
      }
    } on DioException catch (error) {
      final cancelled = CancelToken.isCancel(error);
      final current = find(id);
      if (current != null) {
        await _box.put(
          id,
          current
              .copyWith(
                status: 'failed',
                error: cancelled ? 'Cancelled' : '${error.message ?? error}',
              )
              .toJson(),
        );
      }
      if (!cancelled) rethrow;
    } catch (error) {
      final current = find(id);
      if (current != null) {
        await _box.put(
          id,
          current.copyWith(status: 'failed', error: '$error').toJson(),
        );
      }
      rethrow;
    } finally {
      _tokens.remove(id);
    }
  }

  static Future<void> retry(String id) async {
    final record = find(id);
    if (record == null) return;
    await start(record.media, record.option, referer: record.referer);
  }

  static Future<void> cancel(String id) async {
    _tokens[id]?.cancel('Cancelled by user');
  }

  static Future<void> delete(String id) async {
    _tokens[id]?.cancel('Deleted by user');
    final record = find(id);
    if (record != null) {
      final file = File(record.path);
      if (file.existsSync()) await file.delete();
    }
    await _box.delete(id);
  }

  static Future<int> clearCompleted() async {
    final done = records().where((record) => record.isDone).toList();
    for (final record in done) {
      await delete(record.id);
    }
    return done.length;
  }

  static String _extension(String url, String type) {
    final clean = Uri.tryParse(url)?.path ?? url;
    final match = RegExp(
      r'\.(mp4|m4v|webm)(\?|$)',
      caseSensitive: false,
    ).firstMatch(clean);
    if (match != null) return '.${match.group(1)!.toLowerCase()}';
    if (type.toLowerCase() == 'webm') return '.webm';
    return '.mp4';
  }
}
