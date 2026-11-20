'use strict';
const {handler}=require('../lib/vercel-room.cjs');
module.exports=(req,res)=>{if(req.method!=='POST'){res.setHeader('Allow','POST');res.statusCode=405;return res.end();}return handler(req,res,(room,token,data)=>{if(!room.authenticated(token))return {status:401,body:{error:'This player seat is not recognized. Rejoin with the table code.'}};return room.action(token,data.action,data.data||{});});};
