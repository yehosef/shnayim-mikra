#!/bin/sh
# Renders public/favicon.svg, favicon.ico (16/32/48), apple-touch-icon.png (180)
# and the PWA icons (192, 512, 512 maskable) from scripts/icons/icon.svg.
# Needs rsvg-convert (brew install librsvg) and Python 3 with Pillow.
set -e
cd "$(dirname "$0")/../.."
SRC=scripts/icons/icon.svg
cp "$SRC" public/favicon.svg
for s in 16 32 48 180 192 512; do rsvg-convert -w $s -h $s "$SRC" -o "/tmp/icon-$s.png"; done
cp /tmp/icon-180.png public/apple-touch-icon.png
cp /tmp/icon-192.png public/icon-192.png
cp /tmp/icon-512.png public/icon-512.png
# maskable: the safe zone is the inner 80%, so render a square-cornered
# variant with the artwork scaled into the middle (no rounded edge to bleed).
sed -e 's/rx="14"/rx="0"/' -e 's|<rect x="7"|<g transform="translate(6.4 6.4) scale(0.8)"><rect x="7"|' -e 's|</svg>|</g></svg>|' "$SRC" > /tmp/icon-maskable.svg
rsvg-convert -w 512 -h 512 /tmp/icon-maskable.svg -o public/icon-512-maskable.png
python3 - <<'PY'
from PIL import Image
# .ico with 16/32/48 frames
Image.open('/tmp/icon-48.png').save('public/favicon.ico', sizes=[(16,16),(32,32),(48,48)],
    append_images=[Image.open('/tmp/icon-16.png'), Image.open('/tmp/icon-32.png')])
PY
echo done
