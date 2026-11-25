import 'dart:io';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../../core/downloads/download_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_bottom_nav.dart';
import '../../widgets/tab_pop_scope.dart';

class DownloadsPage extends StatefulWidget {
  const DownloadsPage({super.key});

  @override
  State<DownloadsPage> createState() => _DownloadsPageState();
}

class _DownloadsPageState extends State<DownloadsPage> {
  String _filter = 'all';

  List<DownloadRecord> _records(List<DownloadRecord> all) {
    switch (_filter) {
      case 'downloading':
        return all.where((record) => record.isDownloading).toList();
      case 'completed':
        return all.where((record) => record.isDone).toList();
      default:
        return all;
    }
  }

  @override
  Widget build(BuildContext context) {
    return TabPopScope(
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: SafeArea(
          bottom: false,
          child: Column(
            children: <Widget>[
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 12, 8),
                child: Row(
                  children: <Widget>[
                    const Expanded(
                      child: Text(
                        'Downloads',
                        style: TextStyle(
                          color: AppColors.text,
                          fontSize: 21,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: () async {
                        final count = await DownloadService.clearCompleted();
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Removed $count completed downloads.'),
                            ),
                          );
                        }
                      },
                      tooltip: 'Clear completed',
                      icon: const Icon(Icons.delete_sweep_outlined),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: <String>['all', 'downloading', 'completed']
                      .map(
                        (value) => Padding(
                          padding: const EdgeInsets.only(right: 18),
                          child: InkWell(
                            onTap: () => setState(() => _filter = value),
                            child: Text(
                              value == 'all'
                                  ? 'All'
                                  : value == 'downloading'
                                  ? 'Downloading'
                                  : 'Completed',
                              style: TextStyle(
                                color: _filter == value
                                    ? AppColors.text
                                    : AppColors.muted,
                                fontSize: _filter == value ? 15 : 13.5,
                                fontWeight: _filter == value
                                    ? FontWeight.w900
                                    : FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
              const Divider(height: 1, color: AppColors.step3),
              Expanded(
                child: ValueListenableBuilder(
                  valueListenable: Hive.box('downloads').listenable(),
                  builder: (context, _, __) {
                    final records = _records(DownloadService.records());
                    if (records.isEmpty) {
                      return _empty();
                    }
                    return ListView.separated(
                      padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
                      itemCount: records.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, index) =>
                          _downloadTile(records[index]),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
        bottomNavigationBar: const AppBottomNav(selectedIndex: 2),
      ),
    );
  }

  Widget _empty() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Container(
              width: 92,
              height: 92,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: AppColors.highlightGradient,
              ),
              child: const Icon(
                Icons.file_download_rounded,
                size: 42,
                color: AppColors.step1,
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'No downloads here yet',
              style: TextStyle(
                color: AppColors.text,
                fontSize: 18,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Open any title, choose a resource and press Download. '
              'Files stay on this device for offline playback.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.muted, fontSize: 13, height: 1.5),
            ),
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: () => context.go('/'),
              icon: const Icon(Icons.home_rounded),
              label: const Text('Browse titles'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _downloadTile(DownloadRecord record) {
    final exists = File(record.path).existsSync();
    final progress = record.progress.clamp(0.0, 1.0).toDouble();
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.step3),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  record.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.text,
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: record.isDone
                      ? AppColors.accent
                      : record.isFailed
                      ? const Color(0xFF8C3A3A)
                      : AppColors.step4,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  record.status.toUpperCase(),
                  style: const TextStyle(
                    color: AppColors.text,
                    fontSize: 9.5,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 5),
          Text(
            '${record.language} · ${record.quality}',
            style: const TextStyle(color: AppColors.muted, fontSize: 11.5),
          ),
          if (record.isDownloading) ...<Widget>[
            const SizedBox(height: 10),
            LinearProgressIndicator(
              value: record.total > 0 ? progress : null,
              color: AppColors.accent,
              backgroundColor: AppColors.step3,
              minHeight: 5,
            ),
            const SizedBox(height: 5),
            Text(
              record.total > 0
                  ? '${(progress * 100).round()}% · ${_bytes(record.received)} / ${_bytes(record.total)}'
                  : '${_bytes(record.received)} downloaded',
              style: const TextStyle(color: AppColors.muted, fontSize: 11),
            ),
          ] else if (record.isFailed && record.error.isNotEmpty) ...<Widget>[
            const SizedBox(height: 6),
            Text(
              record.error,
              maxLines: 2,
              style: const TextStyle(color: Color(0xFFFFB4A2), fontSize: 11),
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: <Widget>[
              if (record.isDone && exists)
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => context.push(
                      '/player?url=${Uri.encodeComponent(record.path)}'
                      '&title=${Uri.encodeComponent(record.title)}'
                      '&id=${Uri.encodeComponent(record.itemJson['id']?.toString() ?? record.id)}'
                      '&type=${Uri.encodeComponent(record.itemJson['type']?.toString() ?? 'movie')}'
                      '&local=1',
                    ),
                    icon: const Icon(Icons.play_arrow_rounded, size: 17),
                    label: const Text('Play offline'),
                  ),
                ),
              if (record.isFailed)
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => DownloadService.retry(record.id),
                    icon: const Icon(Icons.refresh_rounded, size: 17),
                    label: const Text('Retry'),
                  ),
                ),
              if (record.isDownloading)
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => DownloadService.cancel(record.id),
                    icon: const Icon(Icons.pause_rounded, size: 17),
                    label: const Text('Cancel'),
                  ),
                ),
              const SizedBox(width: 8),
              IconButton(
                onPressed: () => DownloadService.delete(record.id),
                tooltip: 'Delete',
                icon: const Icon(Icons.delete_outline, color: AppColors.danger),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _bytes(int value) {
    if (value >= 1048576) return '${(value / 1048576).toStringAsFixed(1)} MB';
    if (value >= 1024) return '${(value / 1024).toStringAsFixed(0)} KB';
    return '$value B';
  }
}
