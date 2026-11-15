"""Cut one relief picture for the room heads, with its paper levelled to the page.

  python3 scripts/level-relief.py <source.png> <name>

The image tool paints paper warmer and darker than the page (#f7f4ed), which shows as a tan
cloud where a head's fade meets the page. The paper colour is read from the top left corner
(always clear paper, by the prompts' rule), and every pixel is moved by the difference between
that and the page, in full where the pixel is paper and fading to nothing 70 levels away from
it, so hands, waves and shadows keep their own colour. Then the picture is written at 1536,
1024 and 640 wide as AVIF and WebP into public/assets/relief/relief-<name>-<width>.<type>.
"""
import sys
import numpy as np
from PIL import Image

PAGE = np.array([247, 244, 237], dtype=np.float32)
REACH = 70.0

source, name = sys.argv[1], sys.argv[2]
picture = np.asarray(Image.open(source).convert("RGB"), dtype=np.float32)
paper = np.median(picture[:300, :300].reshape(-1, 3), axis=0)
distance = np.linalg.norm(picture - paper, axis=2, keepdims=True)
weight = np.clip(1 - distance / REACH, 0, 1) ** 0.6
levelled = Image.fromarray(np.clip(picture + weight * (PAGE - paper), 0, 255).astype(np.uint8))
for width in (1536, 1024, 640):
    cut = levelled.resize((width, round(width * levelled.height / levelled.width)), Image.LANCZOS)
    cut.save(f"public/assets/relief/relief-{name}-{width}.webp", quality=84, method=6)
    cut.save(f"public/assets/relief/relief-{name}-{width}.avif", quality=62)
print(name, "paper was", paper.round().tolist())
