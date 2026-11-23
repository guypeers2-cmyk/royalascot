/* The single-file edition may pack, not re-encode, the source plates and
   microphones. Check the runtime URIs themselves, including old negatives. */
'use strict';const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const file=process.argv[2]||process.env.ASCOT_OFFLINE;if(!file)throw Error('Pass the standalone HTML to verify.');const html=fs.readFileSync(file,'utf8'),dir=path.join(__dirname,'../assets'),ctx={window:{},atob,btoa,document:{documentElement:{style:{setProperty(){}}}}};
const sealed=require('../tools/sparse-plates.cjs')(path.join(__dirname,'..'));
const decoder=html.match(/<script>(\/\* fflate[\s\S]*?)<\/script>/);assert.ok(decoder,'offline decoder');vm.runInNewContext(decoder[1],ctx);
const checks=[['ASCOT_ASSETS',/\.webp$/,'data:image/webp;base64,'],['ASCOT_AUDIO',/\.(mp3|m4a|flac|ogg)$/,'data:audio/']];for(const [name,match,type] of checks){const script=html.match(new RegExp('<script>(window\\.'+name+'=[\\s\\S]+?)</script>'));assert.ok(script,name);vm.runInNewContext(script[1],ctx);const map=ctx.window[name],names=[...fs.readdirSync(dir),...sealed.keys()].filter(k=>match.test(k)).sort();assert.deepEqual(Object.keys(map).sort(),names);for(const n of names){const uri=map[n];assert.ok(uri.startsWith(type));assert.ok(Buffer.from(uri.split(',')[1],'base64').equals(sealed.get(n)||fs.readFileSync(path.join(dir,n))),n);}console.log(`${name}: ${names.length} byte-identical local resources.`);}
// Packed text must restore in source order, without evaluating an asset or
// fetching a script. The only stylesheet rewrite is its local URL registry.
const project=path.join(__dirname,'..'),source=fs.readFileSync(path.join(project,'index.html'),'utf8'),z=require('node:zlib');
for(const [tag,pattern] of [['script',/<script src="(js\/[^"]+)"><\/script>/g],['style',/<link rel="stylesheet" href="([^"]+)">/g]]){
 const originals=[...source.matchAll(pattern)].map(x=>x[1]),encoded=[...html.matchAll(new RegExp('<script>ascotUnpack\\("([^"<]+)",(\\d+),"'+tag+'"\\)</script>','g'))];assert.equal(encoded.length,originals.length,tag);
 for(const [i,name] of originals.entries()){const full=path.join(project,name);let code=fs.readFileSync(full,'utf8');if(tag==='style'){code='\n'+code.replace(/url\('([^']+)'\)/g,(_,ref)=>{const asset=path.join(path.dirname(full),ref),ext=path.extname(asset);if(ext==='.webp')return 'var(--plate-'+path.basename(asset,ext)+')';const mime={'.woff':'font/woff','.svg':'image/svg+xml'}[ext];assert.ok(mime);return `url('data:${mime};base64,${fs.readFileSync(asset).toString('base64')}')`;})+'\n';}assert.equal(z.inflateRawSync(ctx.ascot91(encoded[i][1],+encoded[i][2])).toString(),code,name);}
 console.log(`${tag}: ${originals.length} local sources restored in exact order.`);
}
