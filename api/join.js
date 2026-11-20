'use strict';
const {handler}=require('../lib/vercel-room.cjs');
module.exports=(req,res)=>{if(req.method!=='POST'){res.setHeader('Allow','POST');res.statusCode=405;return res.end();}return handler(req,res,(room,_token,data)=>{const joined=room.register({name:data.name,code:data.code,token:data.token});return {token:joined.token,reconnected:joined.reconnected,tableCode:room.joinCode,state:room.snapshot(joined.token)};});};
