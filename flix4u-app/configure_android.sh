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
permissions = ""
if 'android.permission.INTERNET' not in text:
    permissions += '\n    <uses-permission android:name="android.permission.INTERNET" />'
if 'android.permission.RECORD_AUDIO' not in text:
    permissions += '\n    <uses-permission android:name="android.permission.RECORD_AUDIO" />'
if permissions:
    text = re.sub(r'(<manifest\b[^>]*>)', r'\1' + permissions, text, count=1)
path.write_text(text)
print(f"Configured {path}")
PY

for folder in android_icons/mipmap-*; do
  [ -d "$folder" ] || continue
  target="android/app/src/main/res/$(basename "$folder")"
  mkdir -p "$target"
  cp "$folder"/*.png "$target"/
done

# Flix4U palette. Keep the native launch screen, status bar and navigation bar
# in the same dark blue as the Flutter app instead of the default white bars.
mkdir -p android/app/src/main/res/values
mkdir -p android/app/src/main/res/values-night
mkdir -p android/app/src/main/res/values-v23
mkdir -p android/app/src/main/res/values-v27
rm -f android/app/src/main/res/values/ic_launcher_background.xml
cat > android/app/src/main/res/values/colors.xml <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="flix4u_background">#04202E</color>
    <color name="flix4u_surface">#0A3C55</color>
    <color name="ic_launcher_background">#0A3C55</color>
</resources>
XML
cat > android/app/src/main/res/values/styles.xml <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Flix4UTheme" parent="@android:style/Theme.Material.NoActionBar">
        <item name="android:windowBackground">@color/flix4u_background</item>
        <item name="android:statusBarColor">@color/flix4u_background</item>
        <item name="android:navigationBarColor">@color/flix4u_background</item>
    </style>

    <style name="LaunchTheme" parent="Flix4UTheme" />

    <style name="NormalTheme" parent="Flix4UTheme" />
</resources>
XML
cat > android/app/src/main/res/values-night/styles.xml <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="LaunchTheme" parent="Flix4UTheme" />

    <style name="NormalTheme" parent="Flix4UTheme" />
</resources>
XML
cat > android/app/src/main/res/values-v23/styles.xml <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="LaunchTheme" parent="Flix4UTheme">
        <item name="android:windowLightStatusBar">false</item>
    </style>

    <style name="NormalTheme" parent="Flix4UTheme">
        <item name="android:windowLightStatusBar">false</item>
    </style>
</resources>
XML
cat > android/app/src/main/res/values-v27/styles.xml <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="LaunchTheme" parent="Flix4UTheme">
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:windowLightNavigationBar">false</item>
    </style>

    <style name="NormalTheme" parent="Flix4UTheme">
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:windowLightNavigationBar">false</item>
    </style>
</resources>
XML

echo "Android project configured: $PKG / $APP_LABEL"
