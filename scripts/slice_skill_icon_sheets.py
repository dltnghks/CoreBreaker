from pathlib import Path
from PIL import Image

root = Path('public/assets/ui/skills/forged-core')
jobs = [
    ('warrior', ['warrior-smash', 'warrior-shockwave', 'warrior-execute', 'warrior-crush', 'warrior-guard'], 3, 2),
    ('archer', ['archer-rapid', 'archer-pierce', 'archer-ricochet', 'archer-focus', 'archer-weakpoint'], 3, 2),
    ('mage', ['mage-fireball', 'mage-lightning', 'mage-freeze', 'mage-black-hole', 'mage-mana-blast'], 3, 2),
    ('common', ['common-magnet', 'common-luck', 'common-wide', 'common-move-speed', 'common-xp', 'common-combo', 'common-ball-size', 'common-skill-range', 'common-chain', 'common-damage', 'common-magic', 'common-cooldown', 'common-skill-damage', 'common-skill-duration'], 4, 4),
]

for category, names, columns, rows in jobs:
    image = Image.open(root / '_sheets' / f'{category}-sheet-alpha.png').convert('RGBA')
    cell_w, cell_h = image.width // columns, image.height // rows
    out_dir = root / category
    out_dir.mkdir(parents=True, exist_ok=True)
    for index, name in enumerate(names):
        x, y = index % columns, index // columns
        crop = image.crop((x * cell_w, y * cell_h, (x + 1) * cell_w, (y + 1) * cell_h))
        crop = crop.resize((256, 256), Image.Resampling.LANCZOS)
        crop.save(out_dir / f'{name}.png')
