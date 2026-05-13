"""App icon, adaptive icon, splash mark and favicon (DESIGN.md "Status Board").

A 3 x 3 matrix of mastery tiles read along the diagonal, from a locked dash at
the bottom left to a Learned fill at the top right: the map's own encoding.
Run from the repo root: python3 apps/mobile/scripts/icons.py (needs Pillow).
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "assets"
BASE = (0x18, 0x16, 0x12)
SECONDARY = (0xB3, 0xB0, 0xA9)
CONTROL = (0x88, 0x85, 0x7E)
PROVEN_DIM = (0x2B, 0xA7, 0xBF)
PROVEN = (0x65, 0xD5, 0xEC)

GRID = [
    ["open", "checked", "learned"],
    ["seen", "open", "checked"],
    ["locked", "seen", "open"],
]
SS = 4  # supersampling factor


def draw_matrix(size: int, span: float, mono: bool = False) -> Image.Image:
    """The matrix on a transparent canvas; `span` is the grid's width as a fraction of `size`."""
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    grid = s * span
    tile = grid / (3 + 2 * 0.32)
    gap = tile * 0.32
    origin = (s - grid) / 2
    radius = tile * 0.18
    stroke = max(1, round(tile * 0.085))
    white = (255, 255, 255, 255)
    for r, row in enumerate(GRID):
        for c, state in enumerate(row):
            x0 = origin + c * (tile + gap)
            y0 = origin + r * (tile + gap)
            box = (x0, y0, x0 + tile, y0 + tile)
            col = lambda rgb: white if mono else (*rgb, 255)  # noqa: E731
            if state == "open":
                d.rounded_rectangle(box, radius, outline=col(SECONDARY), width=stroke)
            elif state == "seen":
                d.rounded_rectangle(box, radius, outline=col(SECONDARY), width=stroke)
                dot = tile * 0.26
                cx, cy = x0 + tile / 2, y0 + tile / 2
                d.ellipse((cx - dot / 2, cy - dot / 2, cx + dot / 2, cy + dot / 2), fill=col(SECONDARY))
            elif state == "checked":
                # Bottom half filled, clipped to the rounded tile, then the outline on top.
                mask = Image.new("L", (s, s), 0)
                ImageDraw.Draw(mask).rounded_rectangle(box, radius, fill=255)
                half = Image.new("L", (s, s), 0)
                ImageDraw.Draw(half).rectangle((x0, y0 + tile / 2, x0 + tile, y0 + tile), fill=255)
                fill = Image.new("RGBA", (s, s), col(PROVEN_DIM))
                img.paste(fill, (0, 0), ImageChops.darker(mask, half))
                d.rounded_rectangle(box, radius, outline=col(PROVEN_DIM), width=stroke)
            elif state == "learned":
                d.rounded_rectangle(box, radius, fill=col(PROVEN))
            elif state == "locked":
                w, h = tile * 0.46, stroke
                cx, cy = x0 + tile / 2, y0 + tile / 2
                d.rectangle((cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), fill=col(CONTROL))
    return img.resize((size, size), Image.LANCZOS)


def on_ground(size: int, span: float) -> Image.Image:
    ground = Image.new("RGBA", (size, size), (*BASE, 255))
    ground.alpha_composite(draw_matrix(size, span))
    return ground


def main() -> None:
    on_ground(1024, 0.62).convert("RGB").save(OUT / "icon.png")
    # Adaptive icon: the system masks to a circle or squircle inside the 66% safe zone.
    Image.new("RGBA", (512, 512), (*BASE, 255)).save(OUT / "android-icon-background.png")
    draw_matrix(512, 0.42).save(OUT / "android-icon-foreground.png")
    draw_matrix(432, 0.50, mono=True).save(OUT / "android-icon-monochrome.png")
    draw_matrix(1024, 0.86).save(OUT / "splash-icon.png")
    on_ground(48, 0.74).save(OUT / "favicon.png")
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
