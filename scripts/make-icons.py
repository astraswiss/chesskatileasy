# Generates the app icons in public/icons (run: python3 scripts/make-icons.py)
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
S = 1024  # master size

def master(knight_scale=0.70):
    # Diagonal green gradient background with a faint checkerboard.
    top, bottom = (150, 200, 90), (70, 125, 45)
    img = Image.new('RGB', (S, S))
    px = img.load()
    for y in range(S):
        for x in range(S):
            t = (x + y) / (2 * S)
            px[x, y] = tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3))
    img = img.convert('RGBA')
    checker = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(checker)
    n = 8
    c = S // n
    for i in range(n):
        for j in range(n):
            if (i + j) % 2:
                d.rectangle([i * c, j * c, (i + 1) * c, (j + 1) * c], fill=(0, 0, 0, 18))
    img = Image.alpha_composite(img, checker)

    font = ImageFont.truetype(FONT, int(S * knight_scale))
    pos = (S / 2, S / 2 + S * 0.02)
    # soft shadow
    shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).text((pos[0] + S * 0.015, pos[1] + S * 0.025), '♞', font=font, fill=(0, 0, 0, 110), anchor='mm')
    img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(S * 0.02)))
    # knight: dark outline + white fill
    k = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    kd = ImageDraw.Draw(k)
    kd.text(pos, '♞', font=font, fill=(255, 255, 255, 255), anchor='mm', stroke_width=int(S * 0.012), stroke_fill=(30, 45, 20, 255))
    img = Image.alpha_composite(img, k)
    # small "review" accent: star badge bottom-right
    b = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    bd = ImageDraw.Draw(b)
    cx, cy, r = S * 0.76, S * 0.76, S * 0.11
    bd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(27, 172, 166, 255), outline=(255, 255, 255, 255), width=int(S * 0.018))
    bd.text((cx, cy + S * 0.005), '!!', font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', int(r * 1.15)), fill='white', anchor='mm')
    return Image.alpha_composite(img, b)

def rounded(img, radius_ratio=0.22):
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0] - 1, img.size[1] - 1], radius=int(img.size[0] * radius_ratio), fill=255)
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out

full = master()               # full-bleed square (iOS masks it itself)
safe = master(knight_scale=0.56)  # smaller content for Android maskable safe zone

def save(img, size, name):
    img.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name))

save(full.convert('RGB'), 180, 'apple-touch-icon.png')   # iPhone home screen (no transparency)
save(rounded(full), 192, 'icon-192.png')
save(rounded(full), 512, 'icon-512.png')
save(safe.convert('RGB'), 512, 'maskable-512.png')
save(rounded(full), 64, 'favicon-64.png')
save(rounded(full), 32, 'favicon-32.png')
