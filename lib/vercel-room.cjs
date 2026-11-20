'use strict';
const crypto=require('node:crypto');const {createRoom}=require('../server-room.cjs');
let postgres,sql,schemaPromise;
function client(){if(sql)return sql;if(!process.env.DATABASE_URL)throw Error('Vercel database is not configured. Add DATABASE_URL to the project environment.');postgres=require('postgres');sql=postgres(process.env.DATABASE_URL,{max:1,idle_timeout:20,connect_timeout:10,prepare:false});return sql;}
function ensureSchema(db){return schemaPromise||(schemaPromise=db`CREATE TABLE IF NOT EXISTS ascot_shared_table (id smallint PRIMARY KEY CHECK (id=1), join_code text NOT NULL, updated_ms bigint NOT NULL, payload jsonb NOT NULL)`);}
function bearer(req){const m=/^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(req.headers.authorization||'');return m?.[1]||'';}
function sameOrigin(req){const origin=req.headers.origin;if(!origin)return true;try{return new URL(origin).host===(req.headers['x-forwarded-host']||req.headers.host);}catch{return false;}}
function body(req){if(req.body&&typeof req.body==='object')return req.body;if(typeof req.body==='string'){try{return JSON.parse(req.body)}catch{}}return {};}
async function withTable(req,operation){const db=client(),now=Date.now();await ensureSchema(db);
 return db.begin(async tx=>{let joinCode=process.env.ASCOT_TABLE_CODE||crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase();const empty=JSON.stringify({version:1,cabinet:null,players:{}});await tx`INSERT INTO ascot_shared_table (id,join_code,updated_ms,payload) VALUES (1,${joinCode},${now},${empty}::jsonb) ON CONFLICT (id) DO NOTHING`;let [row]=await tx`SELECT join_code,updated_ms,payload FROM ascot_shared_table WHERE id=1 FOR UPDATE`;joinCode=row.join_code;let persisted=typeof row.payload==='string'?JSON.parse(row.payload):row.payload;
   const room=createRoom({dataDir:null,joinCode,initialDb:persisted,autoTick:false,onPersist:next=>{persisted=next;}});
   // Vercel functions sleep between polls. Advance the authoritative clock
   // from database time only while clients are actively polling; discard long
   // idle gaps so a returning player doesn't trigger a huge catch-up request.
   const idleMs=now-Number(row.updated_ms),elapsed=idleMs>=0&&idleMs<1000?Math.min(.25,idleMs/1000):0;if(elapsed)room.tick(elapsed);
   const result=await operation(room,bearer(req),body(req));room.stop();persisted=room.exportDb();await tx`UPDATE ascot_shared_table SET join_code=${joinCode},updated_ms=${now},payload=${JSON.stringify(persisted)}::jsonb WHERE id=1`;return result;
 });}
function send(res,status,payload){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(payload));}
async function handler(req,res,operation){if(!sameOrigin(req)){send(res,403,{error:'Cross-origin requests are not allowed.'});return;}try{const out=await withTable(req,operation);send(res,out?.status||200,out?.body??out);}catch(err){const message=err?.message||'The table could not complete that request.';send(res,/seat is not recognized/i.test(message)?401:400,{error:message});}}
module.exports={handler,send,body};
