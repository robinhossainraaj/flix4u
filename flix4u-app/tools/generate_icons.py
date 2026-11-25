from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1] / "android_icons"
DENSITIES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}
ADAPTIVE = {
    "mdpi": 108,
    "hdpi": 162,
    "xhdpi": 216,
    "xxhdpi": 324,
    "xxxhdpi": 432,
}

PURPLE = (124, 77, 255, 255)
WHITE = (255, 255, 255, 255)


def font(size: int):
    for path in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    ]:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def launcher(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), PURPLE)
    d = ImageDraw.Draw(img)
    # simple play triangle
    cx, cy = size / 2, size / 2
    tri = [
        (cx - size * 0.16, cy - size * 0.22),
        (cx + size * 0.24, cy),
        (cx - size * 0.16, cy + size * 0.22),
    ]
    d.polygon(tri, fill=WHITE)
    return img


def foreground(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = size / 2, size / 2
    tri = [
        (cx - size * 0.12, cy - size * 0.17),
        (cx + size * 0.19, cy),
        (cx - size * 0.12, cy + size * 0.17),
    ]
    d.polygon(tri, fill=WHITE)
    return img


def main():
    for density, size in DENSITIES.items():
        folder = ROOT / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        launcher(size).save(folder / "ic_launcher.png")
    for density, size in ADAPTIVE.items():
        folder = ROOT / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        foreground(size).save(folder / "ic_launcher_foreground.png")
    print(f"Generated icons in {ROOT}")


if __name__ == "__main__":
    main()
