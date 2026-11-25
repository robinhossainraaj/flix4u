import 'package:chewie/chewie.dart';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

class PlayerPage extends StatefulWidget {
  const PlayerPage({
    super.key,
    required this.url,
    required this.title,
    this.referer,
  });

  final String url;
  final String title;
  final String? referer;

  @override
  State<PlayerPage> createState() => _PlayerPageState();
}

class _PlayerPageState extends State<PlayerPage> {
  VideoPlayerController? _videoController;
  ChewieController? _chewieController;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    final uri = Uri.tryParse(widget.url);
    if (uri == null || (!uri.isScheme('http') && !uri.isScheme('https'))) {
      setState(() {
        _error = 'Invalid or missing stream URL.';
        _loading = false;
      });
      return;
    }

    final headers = <String, String>{
      'User-Agent':
          'Mozilla/5.0 (Linux; Android 13; Flix4U) AppleWebKit/537.36',
    };
    if (widget.referer != null && widget.referer!.isNotEmpty) {
      headers['Referer'] = widget.referer!;
    }

    final controller = VideoPlayerController.networkUrl(
      uri,
      httpHeaders: headers,
    );
    _videoController = controller;

    try {
      await controller.initialize();
      if (!mounted) return;
      setState(() {
        _chewieController = ChewieController(
          videoPlayerController: controller,
          autoPlay: true,
          looping: false,
          allowFullScreen: true,
          allowMuting: true,
          showControls: true,
          materialProgressColors: ChewieProgressColors(
            playedColor: const Color(0xFF7C4DFF),
            bufferedColor: Colors.white30,
            handleColor: const Color(0xFF7C4DFF),
            backgroundColor: Colors.white12,
          ),
          errorBuilder: (context, message) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                'Playback error: $message',
                textAlign: TextAlign.center,
              ),
            ),
          ),
        );
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not initialize player: $error';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(_error!, textAlign: TextAlign.center),
              ),
            )
          : _loading || _chewieController == null
          ? const Center(child: CircularProgressIndicator())
          : Center(child: Chewie(controller: _chewieController!)),
    );
  }

  @override
  void dispose() {
    _chewieController?.dispose();
    _videoController?.dispose();
    super.dispose();
  }
}
