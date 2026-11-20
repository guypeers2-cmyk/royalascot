'use strict';
module.exports=(req,res)=>{res.statusCode=200;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({enabled:true,table:'Royal Ascot · Shared Table'}));};
