const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
async function startTestServer(root,transform=(name,body)=>({body})){
 const requests=[];
 const server=http.createServer((q,r)=>{
  const url=new URL(q.url,'http://localhost');requests.push({method:q.method,path:url.pathname});
  if(!url.pathname.startsWith('/planner/')){r.writeHead(200,{'content-type':'text/plain'});r.end('outside planner scope');return;}
  const name=decodeURIComponent(url.pathname.slice('/planner/'.length))||'index.html',file=path.resolve(root,name);
  if(!file.startsWith(path.resolve(root)+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){r.writeHead(404);r.end('not found');return;}
  const result=transform(name,fs.readFileSync(file));const type={'.html':'text/html; charset=utf-8','.js':'application/javascript','.webmanifest':'application/manifest+json','.png':'image/png'}[path.extname(file)]||'application/octet-stream';
  r.writeHead(result.status||200,{'content-type':type,'cache-control':'no-store'});r.end(result.body);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {url:`http://127.0.0.1:${server.address().port}/planner/`,requests,close:()=>new Promise(resolve=>server.close(resolve))};
}
module.exports={startTestServer};
