#!/usr/bin/env python3
"""Local authoring only. Native Git's read-through source for cold artwork in
this workspace's complete, already delivered history bundle. No web requests.
Normal clones and source ZIPs do not use it. --objects gives a read-only
alternate for exporting a new complete bundle without refetching old media.
"""
from pathlib import Path
import os, subprocess as sp, sys, tempfile
root=Path(__file__).resolve().parents[1]; archive=root.parent/'royalascot.bundle'
line=sp.check_output(['git','bundle','list-heads',str(archive),'refs/heads/main'],text=True).split()
if len(line)!=2 or len(line[0])!=40 or any(x not in '0123456789abcdef' for x in line[0]):raise SystemExit('Not a complete Royal Ascot main bundle')
cache=root.parent/'.arena'/'ascot-history'; mirror=cache/(line[0]+'.git')
if not (mirror/'HEAD').is_file():
    cache.mkdir(exist_ok=True,parents=True)
    with tempfile.TemporaryDirectory(dir=cache) as tmp:
        fresh=Path(tmp)/'full.git';sp.run(['git','clone','--bare','--quiet','--',str(archive),str(fresh)],check=True)
        if sp.check_output(['git','-C',str(fresh),'rev-parse','main'],text=True).strip()!=line[0]:raise SystemExit('Bundle moved during checkout')
        try:fresh.rename(mirror)
        except OSError:
            if not (mirror/'HEAD').is_file():raise
if sys.argv[1:]==['--objects']:print(mirror/'objects')
else:
    # Ignore the transport's nominal path. Serve ONLY the verified, local,
    # read-only mirror; only the history needed by the caller leaves it.
    os.execvp('git',['git','-c','uploadpack.allowFilter=true','-c','uploadpack.allowAnySHA1InWant=true','upload-pack','--strict',str(mirror)])
