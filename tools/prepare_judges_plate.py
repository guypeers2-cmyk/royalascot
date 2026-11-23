"""Build the empty gallery registered to the current tangent. The four prior
optical plates are archived photographic negatives, not default build targets.
Use --restore-archives only to reconstruct missing historical media.
"""
from pathlib import Path
import argparse
root=Path(__file__).resolve().parents[1];A=root/'assets'
def restore_archives():
    import numpy as np,cv2 as cv
    from PIL import Image
    raw=np.asarray(Image.open(root/'art-src/judges-rail-master.jpg').convert('RGB').resize((1280,720),Image.Resampling.LANCZOS));y,x=np.mgrid[:720,:1280];clr=raw.astype(float);r,g,b=clr.transpose(2,0,1)
    # Ignore pale posts; the grass-to-grit transition runs across the whole plate.
    green=((g-r)>6)&(g>b*1.07);fraction=green[:,110:-110].mean(axis=1);foot=next(i for i in range(324,373) if fraction[i:i+4].max()<.14)
    sy=np.interp(y,[0,342,719],[0,foot,719]);img=cv.remap(raw,x.astype('f'),sy.astype('f'),cv.INTER_CUBIC,borderMode=cv.BORDER_REPLICATE);Image.fromarray(img).save(A/'judges-rail.webp',quality=93,method=6)
    print('Archival judges’ plate: far rail foot',foot,'→ 342 px')

    # Legacy exposures keep the old plate. New negatives use the tangent camera.
    Image.open(root/'art-src/tangent-camera.jpg').convert('RGB').resize((1280,720),Image.Resampling.LANCZOS).save(A/'tangent-rail.webp',quality=92,method=5)

    from prepare_turf import tile,judges
    if not (A/'turf-fibre.webp').exists():tile(root)
    judges(root)


if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--restore-archives',action='store_true');args=ap.parse_args()
    if args.restore_archives:
        restore_archives()
        from broad_turf import judges
        judges(root)
    from empty_wire import gallery
    gallery(root)
