"""Produce the complete local hand-off from committed main. Never publishes.
Usage: python tools/export_release.py /path/to/empty-output-directory
The source ZIP is upload-ready at its root. Its GitHub name is an alias for
those identical bytes. --aliases uses relative links for the two duplicate
workspace convenience names. Without it, all six files are regular files.
"""
import argparse,os,subprocess,shutil,sys,zipfile
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('directory');p.add_argument('--aliases',action='store_true');args=p.parse_args()
root=Path(__file__).resolve().parents[1];out=Path(args.directory).resolve();out.mkdir(parents=True,exist_ok=True)
if root==out or root in out.parents:raise SystemExit('Choose an output directory outside the source tree.')
def git(*a,**kw):return subprocess.check_output(['git','-C',str(root),*map(str,a)],**kw)
head=git('rev-parse','HEAD',text=True).strip()
if head!=git('rev-parse','main',text=True).strip() or git('status','--porcelain'):raise SystemExit('Export a clean, committed main tree.')
site='royal-ascot-cloudflare.zip';source='royal-ascot-source.zip';book='architect-kit.zip';game='royal-ascot.html';bundle='royalascot.bundle'
# Temporary siblings: an interrupted build never truncates an established file.
def target(name):return out/(name+'.partial')
for name,options in [(site,['.nojekyll','index.html','styles.css','assets','js','licenses','CREDITS.md']),(source,[]),(book,['architect'])]:
    f=target(name);git('archive','--format=zip','-9','--output',f,'HEAD',*options)
    with zipfile.ZipFile(f) as z:
        assert z.comment.decode()==head and z.testzip() is None
    os.replace(f,out/name)
f=target(bundle);f.unlink(missing_ok=True);env=os.environ.copy()
# A space-limited authoring copy can share retired blobs with the preceding
# full local bundle. Export all ancestry even from that copy. Regular clones
# need no cache or earlier archive; hosted code never invokes this helper.
if subprocess.run(['git','-C',str(root),'config','--bool','--get','remote.cabinet-history.promisor'],capture_output=True,text=True).stdout.strip()=='true':
    mirror=subprocess.check_output([sys.executable,str(root/'tools/bundle-cache.py'),'--objects'],text=True).strip()
    env['GIT_ALTERNATE_OBJECT_DIRECTORIES']=os.pathsep.join(filter(None,[mirror,env.get('GIT_ALTERNATE_OBJECT_DIRECTORIES')]))
git('bundle','create',f,'main','HEAD',env=env);git('bundle','verify',f);os.replace(f,out/bundle)
f=target(game);subprocess.run([sys.executable,str(root/'tools/build_offline.py'),str(f)],check=True);os.replace(f,out/game)
def alias(src,dst):
    dst.parent.mkdir(parents=True,exist_ok=True);tmp=dst.with_name(dst.name+'.partial');tmp.unlink(missing_ok=True)
    if args.aliases:tmp.symlink_to(os.path.relpath(src,dst.parent))
    else:shutil.copyfile(src,tmp)
    os.replace(tmp,dst)
alias(out/source,out/'royalascot-github.zip');alias(out/game,out/'github-upload/index.html');print('Local hand-off',head,'| no deploy')
