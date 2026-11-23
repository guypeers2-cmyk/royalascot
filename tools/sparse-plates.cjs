/* Local tools only. A space-limited authoring checkout may skip the oldest
   sealed photographs; a source ZIP, hosted export and ordinary clone have
   them all as regular files. Read ONLY intentionally skipped, named plates
   from the local Git index. Never fetch or resolve HTTP input through Git. */
'use strict';const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
function plates(root){const out=new Map(),missing=[];for(const name of require('./registered-plates.json')){const f='assets/'+name;if(!fs.existsSync(path.join(root,f)))missing.push(f);}
 if(!missing.length)return out;if(!fs.existsSync(path.join(root,'.git')))throw Error('Incomplete source: '+missing.join(', '));
 const git=(...args)=>execFileSync('git',['-C',root,...args],{maxBuffer:1024*1024});const rows=new Set(git('ls-files','-t','--',...missing).toString().trimEnd().split('\n'));
 for(const f of missing){if(!rows.has('S '+f))throw Error('Missing, not sparsified: '+f);out.set(path.basename(f),git('cat-file','blob',':'+f));}return out;
}
module.exports=plates;if(require.main===module){const map=plates(path.resolve(__dirname,'..'));process.stdout.write(JSON.stringify(Object.fromEntries(Array.from(map,([f,b])=>[f,b.toString('base64')]))));}
