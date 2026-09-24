"""Build app icons (the 中 tile on green felt) from the tile SVGs. Needs rsvg-convert.
Run: python3 scripts/make-icons.py"""
import re, subprocess, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
tiles = root / 'public' / 'tiles'
out = root / 'public' / 'icons'
out.mkdir(exist_ok=True)

def inner(name):
    s = (tiles / name).read_text()
    return re.sub(r'^<svg[^>]*>|</svg>\s*$', '', s.strip())

front, face = inner('front.svg'), inner('7z.svg')

def icon(tile_h, rounded):
    tw, th = tile_h * 3 / 4, tile_h
    x, y = (512 - tw) / 2, (512 - th) / 2
    rx = 'rx="104"' if rounded else ''
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<defs><radialGradient id="felt" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="#256b52"/><stop offset="1" stop-color="#163f31"/></radialGradient></defs>
<rect width="512" height="512" {rx} fill="url(#felt)"/>
<rect x="{x + 6}" y="{y + 10}" width="{tw - 4}" height="{th}" rx="{tw * 0.1}" fill="rgba(0,0,0,0.3)"/>
<svg x="{x}" y="{y}" width="{tw}" height="{th}" viewBox="0 0 300 400">{front}{face}</svg>
</svg>'''

(out / 'icon.svg').write_text(icon(340, True))
(out / 'icon-maskable.svg').write_text(icon(290, False))  # tile stays inside the 80% safe zone

def png(src, size, name):
    subprocess.run(['rsvg-convert', '-w', str(size), '-h', str(size), str(out / src), '-o', str(out / name)], check=True)

png('icon.svg', 192, 'icon-192.png')
png('icon.svg', 512, 'icon-512.png')
png('icon-maskable.svg', 512, 'icon-maskable-512.png')
png('icon-maskable.svg', 180, 'apple-touch-icon.png')
print('ok', sorted(p.name for p in out.iterdir()))
