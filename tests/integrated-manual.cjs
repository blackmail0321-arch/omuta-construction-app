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
  await p.goto(base);await p.locator('#wb-new').first().waitFor({state:'attached'});
  await p.evaluate(()=>localStorage.setItem('manual-integration-existing-data','keep'));
  const prior=await p.evaluate(()=>JSON.stringify({...localStorage}));
  await p.locator('.mobilebar [data-view="manual"]').click();
  const f=p.frameLocator('#construction-manual-frame');await f.locator('.hero').waitFor();
  await p.screenshot({path:'/tmp/integrated-manual-before.png',fullPage:true});await f.locator('[data-tab="terms"]').click();await f.locator('.term-details').first().waitFor();assert.equal(await f.locator('.term-details').count(),68);
  await f.locator('.term-details > summary').filter({hasText:'歩掛り'}).click();assert((await f.locator('.term-details[open]').innerText()).includes('具体例で考える'));
  await f.locator('[data-tab="home"]').click();await f.locator('a[href="#pdf/manual"]').click();await f.locator('.manual-pdf').waitFor();await f.locator('#page-back').click();await f.locator('.hero').waitFor();
  for(const width of [390,768,1024]){await p.setViewportSize({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);}
  await p.locator('#manual [data-go="estimate"]').click();assert(await p.locator('#estimate').evaluate(e=>e.classList.contains('active')));
  assert.equal(await p.evaluate(()=>JSON.stringify({...localStorage})),prior);
  await p.locator('.navbtn[data-view="manual"]').click();await f.locator('.hero').waitFor();
  await f.locator('[data-tab="stages"]').click();await f.locator('a[href="#chapter/c22"]').waitFor();
  await f.locator('[data-tab="terms"]').click();await f.locator('.term-details').first().waitFor();
  await p.screenshot({path:'/tmp/integrated-manual-tablet.png',fullPage:false});
  assert.deepEqual(errors,[]);console.log('PASS editor package serves full manual locally; 68 detailed terms, PDF back, procurement chapter, phone navigation, responsive widths, return to estimate and existing storage unchanged');
 }finally{await browser.close();await new Promise(r=>server.close(r));fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
