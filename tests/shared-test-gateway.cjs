/* TEST ONLY. Mock GoTrue login + real PostgREST/RLS. Never deploy this server. */
const http=require('node:http'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),APP=path.join(ROOT,'apps/integrated-v0.13');
const secret='omuta-local-only-jwt-secret-1234567890';
const users=Object.fromEntries(['owner','editor','viewer','outsider'].map((name,k)=>[name+'@example.test',{id:'00000000-0000-0000-0000-'+String(k+1).padStart(12,'0'),email:name+'@example.test'}]));
function sql(query){const r=cp.spawnSync('docker',['exec','-i',process.env.OMUTA_TEST_DB||'omuta-sharing-test-db','psql','-U','postgres','-qAt','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8'});if(r.status)throw Error(r.stderr);return r.stdout.trim();}
for(const [email,user] of Object.entries(users))sql(`insert into auth.users values('${user.id}','${email}') on conflict(id) do nothing;insert into public.shared_accounts values('${user.id}','${email.startsWith('viewer')?'viewer':'editor'}') on conflict(user_id) do nothing;`);
const restPort=cp.execFileSync('docker',['port',process.env.OMUTA_TEST_REST||'omuta-sharing-test-rest','3000/tcp'],{encoding:'utf8'}).trim().split(':').at(-1);
const rest='http://127.0.0.1:'+restPort,refreshTokens=new Map();let refreshCount=0;
function jwt(user,role='authenticated'){
 const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');const parts=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:user?.id,role,exp:Math.floor(Date.now()/1000)+3600});return parts+'.'+crypto.createHmac('sha256',secret).update(parts).digest('base64url');
}
function session(user){const token=crypto.randomUUID();refreshTokens.set(token,user);return {access_token:jwt(user),refresh_token:token,expires_in:3600,user};}
async function start(){
 const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost');const chunks=[];for await(const chunk of req)chunks.push(chunk);const raw=Buffer.concat(chunks);const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
  if(url.pathname==='/auth/v1/token'){
   const body=JSON.parse(raw||'{}');if(url.searchParams.get('grant_type')==='password'){const user=users[body.email];return user&&body.password==='local-test-only'?send(200,session(user)):send(400,{error:'invalid_credentials'});}
   const user=refreshTokens.get(body.refresh_token);refreshCount++;return user?send(200,session(user)):send(401,{error:'expired'});
  }
  if(url.pathname==='/auth/v1/logout'){return send(200,{});}
  if(url.pathname.startsWith('/rest/v1/')){
   const result=await fetch(rest+url.pathname.slice('/rest/v1'.length)+url.search,{method:req.method,headers:{Authorization:req.headers.authorization||'','Content-Type':'application/json'},...(req.method==='GET'?{}:{body:raw})});
   res.writeHead(result.status,{'Content-Type':result.headers.get('content-type')||'application/json','Cache-Control':'no-store'});res.end(await result.text());return;
  }
  if(url.pathname.endsWith('/shared-config.js')){res.writeHead(200,{'Content-Type':'text/javascript'});res.end('window.OMUTA_SHARED_CONFIG='+JSON.stringify({url:'http://127.0.0.1:'+server.address().port,publishableKey:jwt(null,'anon')})+';');return;}
  const file=path.resolve(APP,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
  if(!file.startsWith(APP+path.sep)){res.writeHead(404);res.end();return;}
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
 }catch(error){res.writeHead(500);res.end('Test gateway error');}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return {server,url:'http://127.0.0.1:'+server.address().port,jwt,users,sql,refreshCount:()=>refreshCount};
}
module.exports={start};
