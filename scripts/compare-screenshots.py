#!/usr/bin/env python3
"""Compare saved CUA captures, never taking screenshots itself. Requires Pillow."""
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

root = Path(__file__).resolve().parent.parent
folder = root / 'docs/screenshots'
results = []
for reference in sorted(folder.glob('original-*.png')):
    local = folder / reference.name.replace('original-', 'local-', 1)
    if not local.exists():
        continue
    before = Image.open(reference).convert('RGB')
    after = Image.open(local).convert('RGB')
    if before.size != after.size:
        raise RuntimeError(f'Screenshot dimensions differ: {reference.name}: {before.size} vs {after.size}')
    difference = ImageChops.difference(before, after)
    changed = sum(pixel != (0, 0, 0) for pixel in difference.getdata())
    record = {
        'page': reference.stem.removeprefix('original-'),
        'size': list(before.size),
        'changedPixels': changed,
        'changedPercent': round(100 * changed / (before.width * before.height), 6),
        'meanChannelError': round(sum(ImageStat.Stat(difference).mean) / 3, 6),
        'differenceBounds': difference.getbbox(),
    }
    results.append(record)
    print(f"{record['page']}: {changed} changed pixels, mean channel error {record['meanChannelError']}")
(root / 'docs/visual-checks.json').write_text(json.dumps(results, indent=2) + '\n')
print(f'{sum(item["changedPixels"] == 0 for item in results)}/{len(results)} captures are pixel-identical.')
