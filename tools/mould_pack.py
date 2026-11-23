"""Lossless shipping representation of the quantised cast, not a new mesh.
Keep adjacent deltas in byte planes. The rear triangles are exactly the front
triangles wound backwards on the other flank; store their surveyed index base
instead of a second face list. The caller of CarrierMeshData sees the same
Float32 and Uint16 arrays, in the same order, as the original mould.
"""
import base64, zlib
from pathlib import Path
import numpy as np


def write_mould(root, pos, uv, idx, weights, phase, back_base, front_count):
    root = Path(root)
    assert np.array_equal(idx[front_count:2*front_count], idx[:front_count, ::-1] + back_base)
    triangles = np.concatenate((idx[:front_count], idx[2*front_count:]))
    parts = []
    for data in (pos, uv, triangles, weights, phase):
        a = data.reshape(len(data), -1).astype('int32')
        d = np.diff(a, axis=0, prepend=np.zeros_like(a[:1]))
        for col in d.T:
            for byte in range(data.dtype.itemsize):
                parts.append((col >> (byte*8)).astype('uint8').tobytes())
    codec = zlib.compressobj(9, wbits=-15)
    packed = base64.b64encode(codec.compress(b''.join(parts)) + codec.flush()).decode('ascii')
    # Self-contained even when the hosted script is loaded without the HTML packer.
    decoder = '''/* Exact side-profile cast. See tools/mould_pack.py for the byte-plane format. */
window.CarrierMeshData=function(){
INFLATER
const raw=AscotInflater.unpack(Uint8Array.from(atob('STREAM'),c=>c.charCodeAt(0)));
let at=0;
function read(T,n,lanes){const a=new T(n*lanes),w=T.BYTES_PER_ELEMENT,mask=w===1?255:65535;
 for(let k=0;k<lanes;k++){let v=0;for(let i=0;i<n;i++){v=(v+raw[at+i]+(w===2?raw[at+n+i]<<8:0))&mask;a[lanes*i+k]=v;}at+=n*w;}return a;}
const count=VERTICES,front=FACES*3,base=OTHER,xyz=read(Int16Array,count,3),uv=read(Uint16Array,count,2),tri=read(Uint16Array,TRIANGLES,3),idx=new Uint16Array(tri.length+front);
idx.set(tri.subarray(0,front));for(let i=0;i<front;i+=3){for(let j=0;j<3;j++)idx[front+i+j]=base+tri[i+2-j];}
idx.set(tri.subarray(front),2*front);
return {pos:Float32Array.from(xyz,v=>v/25000),uv:Float32Array.from(uv,v=>v/65535),idx,weights:Float32Array.from(read(Uint8Array,count,1),v=>v/255),phase:Float32Array.from(read(Uint8Array,count,1),v=>v/255*6.283185)};};
'''
    for tag, val in [('VERTICES',len(pos)),('FACES',front_count),('OTHER',back_base),('TRIANGLES',len(triangles)),('STREAM',packed),('INFLATER',(root/'tools/inline-inflate.js').read_text())]:
        decoder = decoder.replace(tag,str(val))
    (root/'js/mould.js').write_text(decoder)
