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
  p.on('dialog',d=>d.accept('サイズ確認用工事'));
  await p.goto(base);await p.locator('.mobilebar [data-view="estimate"]').click();await p.click('#wb-new');
  await p.evaluate(()=>SUBMISSIONS.openDocument(3));await p.locator('#sd-state').selectOption('確認済み');
  for(const id of ['sd-due','sd-submitted','sd-confirmed'])await p.locator('#'+id).fill('2026-08-21');
  await p.locator('#sd-note').fill('不足資料の提出待ち');
  const saved=await p.evaluate(()=>JSON.stringify(WB.project()));
  for(const width of [390,768,1024,1280]){
   await p.setViewportSize({width,height:900});
   const fields=await p.locator('.submission-editor-fields input,.submission-editor-fields select').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),l=e.parentElement.getBoundingClientRect();return {id:e.id,x:r.x,y:r.y,width:r.width,height:r.height,left:l.left,right:l.right};}));
   assert.equal(fields.length,6);for(const f of fields){assert.equal(f.height,52);assert(f.x>=f.left-1&&f.x+f.width<=f.right+1,JSON.stringify(f));}assert(Math.max(...fields.map(f=>f.width))-Math.min(...fields.map(f=>f.width))<1);
   if(width>520){assert(Math.abs(fields[0].y-fields[1].y)<1);assert(Math.abs(fields[2].y-fields[3].y)<1);assert(Math.abs(fields[4].y-fields[5].y)<1);}
   assert.equal(await p.locator('#wb-dialog').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
   if(width===1280){await p.locator('#sd-state').scrollIntoViewIfNeeded();await p.screenshot({path:'/tmp/submission-editor-sizing.png'});}
  }
  await p.locator('[data-clear-date="sd-submitted"]').click();assert.equal(await p.locator('#sd-submitted').inputValue(),'');assert.equal(await p.locator('#sd-confirmed').inputValue(),'2026-08-21');
  await p.locator('#wb-dialog-close').click();assert.equal(await p.evaluate(()=>JSON.stringify(WB.project())),saved);
  await p.evaluate(()=>SUBMISSIONS.openContract());await p.locator('#sc-contract').fill('2026-08-01');assert.equal(await p.locator('#sc-contract').evaluate(e=>e.getBoundingClientRect().height),52);await p.locator('[data-clear-date="sc-contract"]').click();assert.equal(await p.locator('#sc-contract').inputValue(),'');
  assert.deepEqual(errors,[]);console.log('PASS document and contract dialog geometry, 6 matching controls, Safari date CSS, clear-date isolation, 390/768/1024/1280 widths, no overflow and cancelled edits preserve saved project');
 }finally{await browser.close();await new Promise(r=>server.close(r));fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
