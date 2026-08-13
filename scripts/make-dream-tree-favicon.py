"""Build favicon assets from the colorful Dream Tree header mark."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "brand" / "dream-tree-header.webp"
BRAND = ROOT / "public" / "brand"
SCANNER = ROOT / "app" / "scanner"


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    print("source", w, h)

    pixels = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, _a = pixels[x, y]
            if r > 220 and g > 230 and b > 235:
                pixels[x, y] = (r, g, b, 0)
            elif r > 200 and g > 210 and b > 220 and (r + g + b) > 640:
                pixels[x, y] = (r, g, b, 0)

    bbox = im.getbbox()
    print("bbox", bbox)
    if not bbox:
        raise SystemExit("No opaque pixels found")
    cropped = im.crop(bbox)

    cw, ch = cropped.size
    side = max(cw, ch)
    pad = int(side * 0.06)
    side = side + pad * 2
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(cropped, ((side - cw) // 2, (side - ch) // 2), cropped)

    png512 = BRAND / "dream-tree-favicon.png"
    canvas.resize((512, 512), Image.Resampling.LANCZOS).save(png512, "PNG")
    canvas.resize((180, 180), Image.Resampling.LANCZOS).save(SCANNER / "icon.png", "PNG")

    ico_sizes = [(16, 16), (32, 32), (48, 48)]
    imgs = [canvas.resize(size, Image.Resampling.LANCZOS) for size in ico_sizes]
    imgs[0].save(
        BRAND / "dream-tree-favicon.ico",
        format="ICO",
        sizes=ico_sizes,
        append_images=imgs[1:],
    )

    print("wrote", png512, png512.stat().st_size)
    print("wrote", SCANNER / "icon.png")
    print("wrote", BRAND / "dream-tree-favicon.ico")


if __name__ == "__main__":
    main()
