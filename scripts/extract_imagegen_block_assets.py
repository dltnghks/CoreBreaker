from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tmp/imagegen/block-module-atlas.png"
BLOCK_DIR = ROOT / "public/assets/gameplay/blocks"
PROP_DIR = ROOT / "public/assets/gameplay/props"

# Bounds of the generated concept atlas: each row is single, left, middle, right.
ROWS = {
    "standard": (52, 216),
    "guard": (240, 411),
    "explosive": (433, 597),
    "healer": (622, 779),
    "indestructible": (803, 941),
    "reflector": (966, 1100),
    "paddle": (1126, 1203),
}
COLS = ((38, 289), (314, 521), (542, 938), (958, 1203))
# The generated atlas presents the left-cap module first, then the standalone
# module, followed by the repeat and right-cap modules.
PARTS = ("left", "single", "middle", "right")

def remove_white_background(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = []
    for r, g, b, _ in rgba.getdata():
        whiteness = min(r, g, b)
        if whiteness >= 245:
            pixels.append((r, g, b, 0))
        elif whiteness >= 220 and max(r, g, b) - whiteness < 18:
            alpha = int((245 - whiteness) / 25 * 255)
            pixels.append((r, g, b, alpha))
        else:
            pixels.append((r, g, b, 255))
    rgba.putdata(pixels)
    return rgba

def seal_continuation_edge(image: Image.Image, part: str) -> Image.Image:
    """Remove transparent padding only on edges that must touch the next tile."""
    image = image.convert("RGBA")
    pixels = image.load()
    if part in ("left", "middle"):
        for y in range(image.height):
            source_x = max((x for x in range(image.width) if pixels[x, y][3] > 0), default=None)
            if source_x is not None:
                for x in range(source_x, image.width):
                    pixels[x, y] = pixels[source_x, y]
    if part in ("right", "middle"):
        for y in range(image.height):
            source_x = min((x for x in range(image.width) if pixels[x, y][3] > 0), default=None)
            if source_x is not None:
                for x in range(0, source_x + 1):
                    pixels[x, y] = pixels[source_x, y]
    return image

def add_art_padding(image: Image.Image, part: str) -> Image.Image:
    """Move visual spacing into the asset while keeping continuation edges flush."""
    inner_width = {"single": 56, "left": 58, "middle": 60, "right": 58}[part]
    inner = image.resize((inner_width, 26), Image.Resampling.NEAREST)
    padded = Image.new("RGBA", (60, 30), (0, 0, 0, 0))
    x = {"single": 2, "left": 2, "middle": 0, "right": 0}[part]
    padded.alpha_composite(inner, (x, 2))
    return padded

atlas = Image.open(SOURCE)
for kind, (y0, y1) in ROWS.items():
    for part, (x0, x1) in zip(PARTS, COLS):
        crop = remove_white_background(atlas.crop((x0, y0, x1, y1)))
        bbox = crop.getchannel("A").getbbox()
        if bbox:
            crop = crop.crop(bbox)
        # Preserve generated pixel clusters while normalizing the source cell.
        crop = crop.resize((56, 28), Image.Resampling.NEAREST)
        crop = seal_continuation_edge(crop, part)
        crop = add_art_padding(crop, part)
        destination = PROP_DIR if kind == "paddle" else BLOCK_DIR
        prefix = "paddle" if kind == "paddle" else kind
        crop.save(destination / f"{prefix}-{part}.png")
