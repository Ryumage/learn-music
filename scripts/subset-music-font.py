"""Reduziert Noto Music auf die wenigen Glyphen, die die App braucht.

Benötigt: pip install fonttools brotli
Aufruf:   npm run fonts:subset
"""
from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "node_modules/@fontsource/noto-music/files/noto-music-music-400-normal.woff2"
OUT = ROOT / "src/assets/fonts/noto-music-subset.woff2"

# U+1D120 Violinschlüssel mit 8 darunter, ♯ ♭ ♮
UNICODES = [0x1D120, 0x266F, 0x266D, 0x266E]

options = subset.Options()
options.flavor = "woff2"
options.layout_features = []
options.name_IDs = ["*"]
options.notdef_outline = False
options.hinting = False

font = subset.load_font(str(SRC), options)
subsetter = subset.Subsetter(options)
subsetter.populate(unicodes=UNICODES)
subsetter.subset(font)
OUT.parent.mkdir(parents=True, exist_ok=True)
subset.save_font(font, str(OUT), options)
print(f"{OUT.relative_to(ROOT)}: {OUT.stat().st_size} Bytes")
