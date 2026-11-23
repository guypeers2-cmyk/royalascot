"""Split the authoring flank sheet into six small decoded surfaces. No runtime
image exceeds the 28-heading base turntable’s dimensions. Each final format
contains two flanks x twelve posing instants for ONE numbered carriage."""
from pathlib import Path
from PIL import Image
A=Path(__file__).resolve().parents[1]/'assets';source=A/'cast-hd.webp';im=Image.open(source).convert('RGBA');w,h=308,245
for n in range(6):
    out=Image.new('RGBA',(6*w,4*h))
    for side in range(2):
        for ph in range(12):
            x,y=ph*w,(2*n+side)*h;i=side*12+ph;out.paste(im.crop((x,y,x+w,y+h)),((i%6)*w,(i//6)*h))
    out.save(A/f'flank-{n+1}.webp',quality=84,method=6)
source.unlink()
