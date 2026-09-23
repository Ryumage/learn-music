"""Erzeugt die App-Icons (PNG) in public/icons/. Aufruf: python3 scripts/make-icons.py

Motiv: sechs Saiten auf kobaltblauem Grund, darauf eine ganze Note.
Benötigt: pip install pillow
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/icons"
BG = (30, 64, 175)        # Kobaltblau
STRING = (226, 232, 240)  # Saiten
NOTE = (255, 255, 255)


def draw(size: int, padding: float, rounded: bool) -> Image.Image:
    s = 4  # Supersampling
    n = size * s
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, n - 1, n - 1], radius=int(n * 0.22), fill=BG)
    else:
        d.rectangle([0, 0, n, n], fill=BG)
    inner = n * (1 - 2 * padding)
    x0 = n * padding
    y0 = n * padding + inner * 0.18
    gap = inner * 0.64 / 5
    for i in range(6):
        y = y0 + i * gap
        w = max(1, int(n * (0.006 + 0.004 * i)))  # tiefe Saiten dicker
        d.line([(x0, y), (x0 + inner, y)], fill=STRING, width=w)
    # ganze Note (hohl, schräg) auf der 3./4. Saite
    cx, cy = x0 + inner * 0.5, y0 + gap * 2.5
    rx, ry = gap * 0.95, gap * 0.62
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=NOTE)
    hole = Image.new("L", (n, n), 0)
    hd = ImageDraw.Draw(hole)
    hrx, hry = rx * 0.42, ry * 0.78
    hd.ellipse([cx - hrx, cy - hry, cx + hrx, cy + hry], fill=255)
    hole = hole.rotate(-35, center=(cx, cy))
    img.paste(BG + (255,), mask=hole)
    return img.resize((size, size), Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
draw(192, 0.12, True).save(OUT / "icon-192.png")
draw(512, 0.12, True).save(OUT / "icon-512.png")
draw(512, 0.2, False).save(OUT / "icon-maskable-512.png")
draw(180, 0.12, False).convert("RGB").save(OUT / "apple-touch-icon.png")
print("Icons geschrieben nach", OUT.relative_to(ROOT))
