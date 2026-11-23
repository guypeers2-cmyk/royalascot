'use strict';
const {handler}=require('../lib/vercel-room.cjs');
module.exports=(req,res)=>{if(req.method!=='POST'){res.setHeader('Allow','POST');res.statusCode=405;return res.end();}return handler(req,res,(room,token)=>{if(token)room.leave?.(token);return {ok:true};});};
