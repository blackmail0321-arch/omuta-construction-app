/* Serve the exact editor deploy package, not a source-directory shortcut. */
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),cp=require('node:child_process');
(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'integrated-manual-')),output=path.join(tmp,'sites');
 cp.execFileSync('python3',['scripts/package_shared.py','--output',output],{cwd:path.resolve(__dirname,'..'),env:{...process.env,SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:''}});
 const root=path.join(output,'editor'),server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://local').pathname).replace(/^\//,'')||'index.html',file=path.resolve(root,name);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end();}
  const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.json':'application/json','.css':'text/css','.pdf':'application/pdf','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  res.end(name==='shared/shared-config.js'?"window.OMUTA_SHARED_CONFIG={url:'',publishableKey:''};":fs.readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/',browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844}}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base);await p.locator('.mobilebar [data-view="docs"]').click();
  await p.locator('#sub-period').fill('2026-11');
  for(const width of [390,768,1024,1280]){
   await p.setViewportSize({width,height:900});
   const fields=await p.locator('.submission-filters input,.submission-filters select').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),l=e.parentElement.getBoundingClientRect();return {id:e.id,x:r.x,y:r.y,width:r.width,height:r.height,left:l.left,right:l.right,value:e.value};}));
   assert.equal(fields.length,4);for(const f of fields){assert.equal(f.height,52);assert(f.x>=f.left-1&&f.x+f.width<=f.right+1,JSON.stringify(f));}assert(Math.max(...fields.map(f=>f.width))-Math.min(...fields.map(f=>f.width))<1);
   assert.equal(await p.locator('#sub-period').inputValue(),'2026-11');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
   if(width>520){assert(Math.abs(fields[0].y-fields[1].y)<1);assert(Math.abs(fields[2].y-fields[3].y)<1);}
   if(width===1280){await p.locator('#sub-period').scrollIntoViewIfNeeded();await p.screenshot({path:'/tmp/submission-filters-tablet.png'});}
  }
  await p.locator('#sub-view').selectOption('folders');assert.equal(await p.locator('#sub-view').inputValue(),'folders');await p.locator('#sub-view').selectOption('list');
  assert.deepEqual(errors,[]);console.log('PASS 4 equal-width/equal-height filters at 390/768/1024/1280, field containment, row alignment, month entry and display selection');
 }finally{await browser.close();await new Promise(r=>server.close(r));fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
