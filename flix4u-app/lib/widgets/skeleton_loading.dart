import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// One shared ticker for every shimmer in the app. Keeping a single controller
/// means adding skeletons to lists does not create one animation per card.
class ShimmerScope extends StatefulWidget {
  const ShimmerScope({
    super.key,
    required this.child,
    this.duration = const Duration(milliseconds: 1400),
  });

  final Widget child;
  final Duration duration;

  @override
  State<ShimmerScope> createState() => _ShimmerScopeState();
}

class _ShimmerScopeState extends State<ShimmerScope>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.duration)
      ..repeat();
  }

  @override
  void didUpdateWidget(covariant ShimmerScope oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.duration != oldWidget.duration) {
      _controller.duration = widget.duration;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _ShimmerScopeData(notifier: _controller, child: widget.child);
  }
}

class _ShimmerScopeData extends InheritedNotifier<AnimationController> {
  const _ShimmerScopeData({
    super.key,
    required super.notifier,
    required super.child,
  });

  static AnimationController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<_ShimmerScopeData>();
    assert(scope != null, 'Shimmer must be used inside a ShimmerScope.');
    return scope!.notifier!;
  }
}

/// Applies a subtle left-to-right highlight to opaque skeleton blocks only.
class Shimmer extends StatelessWidget {
  const Shimmer({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final controller = _ShimmerScopeData.of(context);
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: controller,
        child: child,
        builder: (BuildContext context, Widget? child) {
          final value = controller.value;
          final gradient = LinearGradient(
            begin: Alignment(-1.0 + (2 * value), 0),
            end: Alignment(0.0 + (2 * value), 0),
            colors: const <Color>[
              AppColors.step3,
              AppColors.step3,
              Color(0xA6E1F2FA),
              AppColors.step3,
              AppColors.step3,
            ],
            stops: const <double>[0, 0.34, 0.5, 0.66, 1],
          );
          return ShaderMask(
            blendMode: BlendMode.srcATop,
            shaderCallback: (Rect bounds) => gradient.createShader(bounds),
            child: child ?? const SizedBox.shrink(),
          );
        },
      ),
    );
  }
}

class SkeletonBox extends StatelessWidget {
  const SkeletonBox({
    super.key,
    this.width,
    this.height = 12,
    this.radius = 6,
    this.color = AppColors.step3,
  });

  final double? width;
  final double height;
  final double radius;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}

class SkeletonLine extends StatelessWidget {
  const SkeletonLine({
    super.key,
    required this.width,
    this.height = 12,
    this.radius = 6,
  });

  final double width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return SkeletonBox(width: width, height: height, radius: radius);
  }
}

class SkeletonCircle extends StatelessWidget {
  const SkeletonCircle({super.key, required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return SkeletonBox(width: size, height: size, radius: size / 2);
  }
}

/// Shimmering placeholder for a cached network image while it loads.
class SkeletonThumbnail extends StatelessWidget {
  const SkeletonThumbnail({
    super.key,
    required this.height,
    this.width = double.infinity,
    this.radius = 8,
  });

  final double height;
  final double width;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Shimmer(
      child: SkeletonBox(width: width, height: height, radius: radius),
    );
  }
}

/// Fades between loading, success, empty and error states without moving layout.
class ContentSwitcher extends StatelessWidget {
  const ContentSwitcher({
    super.key,
    required this.stateKey,
    required this.child,
  });

  final String stateKey;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 220),
      switchInCurve: Curves.easeOut,
      switchOutCurve: Curves.easeIn,
      transitionBuilder: (Widget child, Animation<double> animation) {
        return FadeTransition(opacity: animation, child: child);
      },
      child: KeyedSubtree(key: ValueKey<String>(stateKey), child: child),
    );
  }
}

class SkeletonErrorState extends StatelessWidget {
  const SkeletonErrorState({
    super.key,
    required this.message,
    required this.onRetry,
    this.title = 'Could not load',
    this.actionLabel = 'Try again',
  });

  final String title;
  final String message;
  final VoidCallback onRetry;
  final String actionLabel;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            const Icon(Icons.wifi_off_rounded, size: 42, color: AppColors.muted),
            const SizedBox(height: 12),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.text,
                fontSize: 16,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.muted, fontSize: 12.5),
            ),
            const SizedBox(height: 14),
            FilledButton(onPressed: onRetry, child: Text(actionLabel)),
          ],
        ),
      ),
    );
  }
}

class HomeSkeleton extends StatelessWidget {
  const HomeSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Shimmer(
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: const <Widget>[
            HeroSkeleton(),
            FeatureCardsSkeleton(),
            CategoryRowSkeleton(),
            RailSkeleton(titleWidth: 150, subtitleWidth: 210),
            RailSkeleton(titleWidth: 130, subtitleWidth: 180),
            SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class HeroSkeleton extends StatelessWidget {
  const HeroSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: <Widget>[
        Container(
          height: 238,
          margin: const EdgeInsets.symmetric(horizontal: 6),
          decoration: BoxDecoration(
            color: AppColors.step3,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Stack(
            children: <Widget>[
              const Positioned(
                left: 12,
                top: 12,
                child: Row(
                  children: <Widget>[
                    SkeletonBox(width: 66, height: 22, radius: 6),
                    SizedBox(width: 6),
                    SkeletonBox(width: 48, height: 22, radius: 6),
                  ],
                ),
              ),
              Positioned(
                left: 14,
                right: 14,
                bottom: 14,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const <Widget>[
                    SkeletonLine(width: 190, height: 22, radius: 7),
                    SizedBox(height: 6),
                    SkeletonLine(width: 132, height: 19, radius: 7),
                    SizedBox(height: 8),
                    SkeletonLine(width: 108, height: 11),
                    SizedBox(height: 12),
                    Row(
                      children: <Widget>[
                        SkeletonBox(width: 126, height: 38, radius: 19),
                        SizedBox(width: 8),
                        SkeletonBox(width: 72, height: 38, radius: 19),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            SkeletonBox(width: 20, height: 5, radius: 4),
            SizedBox(width: 6),
            SkeletonBox(width: 6, height: 5, radius: 4),
            SizedBox(width: 6),
            SkeletonBox(width: 6, height: 5, radius: 4),
            SizedBox(width: 6),
            SkeletonBox(width: 6, height: 5, radius: 4),
          ],
        ),
      ],
    );
  }
}

class FeatureCardsSkeleton extends StatelessWidget {
  const FeatureCardsSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    const widths = <double>[286, 300, 286];
    return SizedBox(
      height: 63,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 13),
        scrollDirection: Axis.horizontal,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: widths.length,
        separatorBuilder: (_, __) => const SizedBox(width: 9),
        itemBuilder: (context, index) {
          return Container(
            width: widths[index],
            height: 63,
            decoration: BoxDecoration(
              color: AppColors.step2,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Stack(
              children: <Widget>[
                const Positioned(
                  left: 8,
                  top: 7,
                  child: SkeletonBox(width: 43, height: 53, radius: 4),
                ),
                Positioned(
                  left: 58,
                  right: 46,
                  top: 11,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const <Widget>[
                      SkeletonLine(width: 170, height: 12),
                      SizedBox(height: 7),
                      SkeletonLine(width: 118, height: 10),
                    ],
                  ),
                ),
                const Positioned(
                  right: 10,
                  top: 17,
                  child: SkeletonCircle(size: 27),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class CategoryRowSkeleton extends StatelessWidget {
  const CategoryRowSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        const Padding(
          padding: EdgeInsets.fromLTRB(13, 14, 13, 8),
          child: SkeletonLine(width: 96, height: 17, radius: 6),
        ),
        SizedBox(
          height: 43,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 13),
            scrollDirection: Axis.horizontal,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: 3,
            separatorBuilder: (_, __) => const SizedBox(width: 9),
            itemBuilder: (context, index) => SkeletonBox(
              width: index == 0 ? 48 : 124,
              height: 43,
              radius: 6,
            ),
          ),
        ),
      ],
    );
  }
}

class RailSkeleton extends StatelessWidget {
  const RailSkeleton({
    super.key,
    this.titleWidth = 150,
    this.subtitleWidth = 210,
  });

  final double titleWidth;
  final double subtitleWidth;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 13),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                SkeletonLine(width: titleWidth, height: 17, radius: 6),
                const SizedBox(height: 5),
                SkeletonLine(width: subtitleWidth, height: 11),
              ],
            ),
          ),
          const SizedBox(height: 9),
          SizedBox(
            height: 198,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 13),
              scrollDirection: Axis.horizontal,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: 6,
              separatorBuilder: (_, __) => const SizedBox(width: 9),
              itemBuilder: (context, index) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const <Widget>[
                    SkeletonBox(width: 122, height: 160, radius: 8),
                    SizedBox(height: 6),
                    SkeletonLine(width: 112, height: 12),
                    SizedBox(height: 4),
                    SkeletonLine(width: 82, height: 10),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class SearchResultsSkeleton extends StatelessWidget {
  const SearchResultsSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Shimmer(
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(13, 8, 13, 24),
        itemCount: 8,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          return Container(
            height: 94,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: const <Widget>[
                SkeletonBox(width: 55, height: 74, radius: 4),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: <Widget>[
                      SkeletonLine(width: 190, height: 14),
                      SizedBox(height: 10),
                      SkeletonLine(width: 145, height: 11),
                    ],
                  ),
                ),
                SizedBox(width: 8),
                SkeletonCircle(size: 26),
              ],
            ),
          );
        },
      ),
    );
  }
}

class CategoryGridSkeleton extends StatelessWidget {
  const CategoryGridSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Shimmer(
      child: Column(
        children: <Widget>[
          const Divider(height: 1, color: AppColors.step3),
          Padding(
            padding: const EdgeInsets.fromLTRB(13, 10, 13, 0),
            child: Row(
              children: const <Widget>[
                SkeletonBox(width: 70, height: 30, radius: 15),
                SizedBox(width: 8),
                SkeletonBox(width: 78, height: 30, radius: 15),
                SizedBox(width: 8),
                SkeletonBox(width: 60, height: 30, radius: 15),
                Spacer(),
                SkeletonCircle(size: 30),
              ],
            ),
          ),
          Expanded(
            child: GridView.count(
              padding: const EdgeInsets.fromLTRB(13, 14, 13, 24),
              crossAxisCount: 3,
              crossAxisSpacing: 8,
              mainAxisSpacing: 14,
              childAspectRatio: 0.62,
              physics: const NeverScrollableScrollPhysics(),
              children: const <Widget>[
                _GridSkeletonCard(),
                _GridSkeletonCard(),
                _GridSkeletonCard(),
                _GridSkeletonCard(),
                _GridSkeletonCard(),
                _GridSkeletonCard(),
                _GridSkeletonCard(),
                _GridSkeletonCard(),
                _GridSkeletonCard(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _GridSkeletonCard extends StatelessWidget {
  const _GridSkeletonCard();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: const <Widget>[
        Expanded(child: SkeletonBox(height: double.infinity, radius: 5)),
        SizedBox(height: 6),
        SkeletonLine(width: 96, height: 11),
        SizedBox(height: 4),
        SkeletonLine(width: 62, height: 9),
      ],
    );
  }
}

class DetailSkeleton extends StatelessWidget {
  const DetailSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Shimmer(
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const <Widget>[
          SkeletonBox(width: double.infinity, height: 280, radius: 0),
          Padding(
            padding: EdgeInsets.fromLTRB(16, 18, 16, 30),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                SkeletonLine(width: 210, height: 12),
                SizedBox(height: 14),
                SkeletonLine(width: double.infinity, height: 12),
                SizedBox(height: 8),
                SkeletonLine(width: double.infinity, height: 12),
                SizedBox(height: 8),
                SkeletonLine(width: 160, height: 12),
                SizedBox(height: 22),
                Row(
                  children: <Widget>[
                    Expanded(child: SkeletonBox(height: 48, radius: 14)),
                    SizedBox(width: 10),
                    SizedBox(width: 96, child: SkeletonBox(height: 48, radius: 14)),
                  ],
                ),
                SizedBox(height: 12),
                Row(
                  children: <Widget>[
                    Expanded(child: SkeletonBox(height: 48, radius: 14)),
                    SizedBox(width: 10),
                    Expanded(child: SkeletonBox(height: 48, radius: 14)),
                  ],
                ),
                SizedBox(height: 12),
                SkeletonBox(width: 150, height: 48, radius: 14),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class PlayerSkeleton extends StatelessWidget {
  const PlayerSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 232,
      color: Colors.black,
      child: Shimmer(
        child: Stack(
          children: const <Widget>[
            Positioned(
              left: 14,
              top: 18,
              child: SkeletonBox(width: 86, height: 18, radius: 6),
            ),
            Positioned(
              left: 13,
              right: 13,
              bottom: 24,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  SkeletonLine(width: 150, height: 10),
                  SizedBox(height: 12),
                  Row(
                    children: <Widget>[
                      SkeletonCircle(size: 22),
                      SizedBox(width: 10),
                      Expanded(child: SkeletonBox(height: 4, radius: 2)),
                      SizedBox(width: 10),
                      SkeletonLine(width: 34, height: 10),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class ShortTvSkeleton extends StatelessWidget {
  const ShortTvSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black,
      child: Stack(
        fit: StackFit.expand,
        children: <Widget>[
          const DecoratedBox(decoration: BoxDecoration(gradient: AppColors.cardGradient)),
          Positioned.fill(
            child: Shimmer(
              child: Stack(
                children: const <Widget>[
                  Positioned(
                    left: 14,
                    top: 16,
                    child: SkeletonLine(width: 140, height: 14),
                  ),
                  Positioned(
                    right: 12,
                    bottom: 110,
                    child: Column(
                      children: <Widget>[
                        SkeletonCircle(size: 42),
                        SizedBox(height: 18),
                        SkeletonCircle(size: 42),
                        SizedBox(height: 18),
                        SkeletonCircle(size: 42),
                      ],
                    ),
                  ),
                  Positioned(
                    left: 14,
                    right: 80,
                    bottom: 94,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        SkeletonLine(width: 210, height: 18),
                        SizedBox(height: 7),
                        SkeletonLine(width: 120, height: 11),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ShortVideoLoadingSkeleton extends StatelessWidget {
  const ShortVideoLoadingSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Shimmer(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: const <Widget>[
          SkeletonCircle(size: 46),
          SizedBox(height: 8),
          SkeletonLine(width: 96, height: 9),
        ],
      ),
    );
  }
}
