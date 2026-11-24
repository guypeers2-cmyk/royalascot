'use strict';
const {handler}=require('../lib/vercel-room.cjs');
function getOp(req){
  try{return new URL(req.url,'http://site.invalid').searchParams.get('op')||'';}catch{return '';}
}
module.exports=(req,res)=>{
  const op=getOp(req);
  if(op==='status'){
    if(req.method!=='GET'){res.setHeader('Allow','GET');res.statusCode=405;return res.end();}
    return handler(req,res,(room)=>({table:'Royal Ascot · Shared Table',...room.adminStatus()}));
  }
  if(op==='setup'){
    if(req.method!=='POST'){res.setHeader('Allow','POST');res.statusCode=405;return res.end();}
    return handler(req,res,(room,_tok,data)=>room.adminSetup(data));
  }
  if(op==='login'){
    if(req.method!=='POST'){res.setHeader('Allow','POST');res.statusCode=405;return res.end();}
    return handler(req,res,(room,_tok,data)=>room.adminLogin(data));
  }
  if(op==='logout'){
    if(req.method!=='POST'){res.setHeader('Allow','POST');res.statusCode=405;return res.end();}
    return handler(req,res,(room,token)=>{room.adminLogout(token);return {ok:true};});
  }
  if(op==='overview'){
    if(req.method!=='GET'){res.setHeader('Allow','GET');res.statusCode=405;return res.end();}
    return handler(req,res,(room,token)=>{const snap=room.adminSnapshot(token);return snap?snap:{status:401,body:{error:'Administrator session expired or unauthorized.'}};});
  }
  if(op==='reset'){
    if(req.method!=='POST'){res.setHeader('Allow','POST');res.statusCode=405;return res.end();}
    return handler(req,res,(room,token,data)=>{if(!room.adminAuth(token))return {status:401,body:{error:'Administrator session expired or unauthorized.'}};return room.adminResetServer(token,data);});
  }
  if(op==='action'){
    if(req.method!=='POST'){res.setHeader('Allow','POST');res.statusCode=405;return res.end();}
    return handler(req,res,(room,token,data)=>{if(!room.adminAuth(token))return {status:401,body:{error:'Administrator session expired or unauthorized.'}};return room.adminAction(token,data.action,data.data||{});});
  }
  res.statusCode=404;res.end(JSON.stringify({error:'Unknown administrator endpoint.'}));
};
