#!/usr/bin/env bash
set -e

PKG="com.flix4u.rorax"
APP_LABEL="Flix4U"

python3 - "$PKG" <<'PY'
import re
import sys
from pathlib import Path

pkg = sys.argv[1]
for name in ("android/app/build.gradle", "android/app/build.gradle.kts"):
    path = Path(name)
    if not path.exists():
        continue
    text = path.read_text()

    text = re.sub(
        r'(applicationId\s*=?\s*)"[^"]+"',
        lambda m: f'{m.group(1)}"{pkg}"',
        text,
    )
    text = re.sub(
        r'(namespace\s*=?\s*)"[^"]+"',
        lambda m: f'{m.group(1)}"{pkg}"',
        text,
    )
    text = re.sub(r'(versionCode\s*=?\s*)\d+', lambda m: f'{m.group(1)}1', text)
    text = re.sub(r'(versionName\s*=?\s*)"[^"]+"', lambda m: f'{m.group(1)}"1.0.0"', text)
    text = re.sub(r'(minSdkVersion\s*=?\s*)\d+', lambda m: f'{m.group(1)}21', text)
    text = re.sub(r'(minSdk\s*=?\s*)\d+', lambda m: f'{m.group(1)}21', text)
    path.write_text(text)
    print(f"Configured {path}")
PY

python3 - "$PKG" <<'PY'
import re
import sys
from pathlib import Path

pkg = sys.argv[1]
kotlin_root = Path("android/app/src/main/kotlin")
java_root = Path("android/app/src/main/java")
target_dir = Path("android/app/src/main/kotlin") / Path(*pkg.split("."))
target = target_dir / "MainActivity.kt"

source = None
for root in (kotlin_root, java_root):
    if not root.exists():
        continue
    for candidate in list(root.rglob("MainActivity.kt")) + list(root.rglob("MainActivity.java")):
        source = candidate
        break
    if source:
        break

if source:
    text = source.read_text()
    text = re.sub(r"^package\s+[^\s;]+\s*;?\s*$", f"package {pkg}", text, count=1, flags=re.MULTILINE)
    target_dir.mkdir(parents=True, exist_ok=True)
    target.write_text(text)
    if source.resolve() != target.resolve():
        source.unlink()
    print(f"Moved MainActivity to {target}")
else:
    print("Warning: MainActivity source not found")
PY

python3 - "$APP_LABEL" <<'PY'
import re
import sys
from pathlib import Path

label = sys.argv[1]
path = Path("android/app/src/main/AndroidManifest.xml")
text = path.read_text()
text = re.sub(r'android:label="[^"]*"', f'android:label="{label}"', text, count=1)
if 'android.permission.INTERNET' not in text:
    text = re.sub(
        r'(<manifest\b[^>]*>)',
        r'\1\n    <uses-permission android:name="android.permission.INTERNET" />',
        text,
        count=1,
    )
path.write_text(text)
print(f"Configured {path}")
PY

for folder in android_icons/mipmap-*; do
  [ -d "$folder" ] || continue
  target="android/app/src/main/res/$(basename "$folder")"
  mkdir -p "$target"
  cp "$folder"/*.png "$target"/
done

# Some Flutter templates define the adaptive icon background in colors.xml.
mkdir -p android/app/src/main/res/values
cat > android/app/src/main/res/values/ic_launcher_background.xml <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#7C4DFF</color>
</resources>
XML

echo "Android project configured: $PKG / $APP_LABEL"
