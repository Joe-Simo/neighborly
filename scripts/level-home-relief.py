from PIL import Image
import numpy as np
page = np.array([0xee, 0xe7, 0xd7], float)
src = {'call': ('relief-trial-1.png', False), 'visit': ('relief-visit-20261115T205841-0447.png', True), 'help': ('relief-help-redo.png', False), 'year': ('relief-year-redo.png', True)}
for k, (f, flip) in src.items():
    im = Image.open('/mnt/project-files/' + f).convert('RGB')
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    a = np.asarray(im, float)
    lum = a.sum(2)
    paper = np.median(a[lum > np.percentile(lum, 70)], 0)
    a = a * (page / paper)
    d = np.sqrt(((a - page) ** 2).sum(2))
    near = np.clip(1 - (d - 16) / 30, 0, 1)
    wide = np.clip(1 - (d - 60) / 40, 0, 1)  # embossed lines and soft shadows in the paper, not the coloured shapes
    h, w = d.shape
    y, x = np.mgrid[0:h, 0:w]
    e = np.minimum.reduce([x / w, (w - 1 - x) / w, y / h, (h - 1 - y) / h])
    edge = np.clip(1 - e / .16, 0, 1); edge = edge * edge * (3 - 2 * edge)
    rim = np.clip(1 - e / .08, 0, 1); rim = rim * rim * (3 - 2 * rim)
    wgt = np.maximum(near, wide * rim)[..., None]  # the picture's paper becomes the page's paper everywhere
    a = a * (1 - wgt) + page * wgt
    out = Image.fromarray(np.clip(a, 0, 255).astype('uint8'))
    for W in (1536, 768):
        out.resize((W, W * 2 // 3), Image.LANCZOS).save(f'public/assets/home/relief-{k}-{W}.webp', 'WEBP', quality=82, method=6)
print('done')
