# Generates the PWA icons (run once: python3 scripts/make-icons.py)
from PIL import Image, ImageDraw, ImageFont
import os
out = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
font_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

def icon(size, pad_ratio, name, rounded):
    img = Image.new('RGBA', (size, size), (22, 21, 18, 255))
    d = ImageDraw.Draw(img)
    pad = int(size * pad_ratio)
    r = int(size * 0.18) if rounded else 0
    d.rounded_rectangle([pad, pad, size - pad, size - pad], radius=r, fill=(129, 182, 76, 255))
    f = ImageFont.truetype(font_path, int((size - 2 * pad) * 0.78))
    d.text((size / 2, size / 2 + size * 0.02), '♞', font=f, fill=(22, 21, 18, 255), anchor='mm')
    img.save(os.path.join(out, name))

icon(192, 0.08, 'icon-192.png', True)
icon(512, 0.08, 'icon-512.png', True)
icon(512, 0.16, 'maskable-512.png', False)
icon(180, 0.0, 'apple-touch-icon.png', False)
