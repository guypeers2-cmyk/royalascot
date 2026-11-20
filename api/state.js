'use strict';
const {handler}=require('../lib/vercel-room.cjs');
module.exports=(req,res)=>{if(req.method!=='GET'){res.setHeader('Allow','GET');res.statusCode=405;return res.end();}return handler(req,res,(room,token)=>{const data=room.snapshot(token);return data?data:{status:401,body:{error:'This player seat is not recognized. Rejoin with the table code.'}};});};
