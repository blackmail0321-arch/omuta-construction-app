const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
const {startTestServer}=require('./test-server.cjs');
(async()=>{
 let variant='A',broken=false;
 const root=path.resolve(__dirname,'..');
 const server=await startTestServer(root,(name,body)=>{
  if(name==='service-worker.js')body=Buffer.from(body.toString().replace(/const VERSION = '[^']+';/,`const VERSION = 'test-${variant}';`));
  if(name==='index.html')body=Buffer.from(body.toString().replace('<body>',`<body data-test-version="${variant}">`));
  if(broken&&name==='icons/icon-512.png')return{body:Buffer.from('test install failure'),status:503};
  return{body};
 });
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:768,height:1024},hasTouch:true,isMobile:true,acceptDownloads:true});let p=await context.newPage();const errors=[];let dialogs=[];
  const attach=page=>{page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.message());d.accept();});};attach(p);
  await p.goto(server.url);await p.waitForFunction(()=>document.getElementById('offline-banner').dataset.state==='ready');await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
  assert.match(await p.locator('#offline-status').innerText(),/準備完了/);
  const manifest=await p.evaluate(async()=>{const r=await fetch('manifest.webmanifest');return r.json();});assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'./index.html');assert.equal(await p.locator('link[rel="apple-touch-icon"]').count(),1);
  // Simulate terminating every app window, then relaunch while completely disconnected.
  await p.close();await context.setOffline(true);p=await context.newPage();attach(p);await p.goto(server.url+'index.html');await p.waitForFunction(()=>document.getElementById('offline-banner').dataset.state==='ready');assert.equal(await p.locator('body').getAttribute('data-test-version'),'A');assert.match(await p.locator('#offline-connection').innerText(),/オフライン/);
  await p.selectOption('#fiscal-year','2027');await p.click('[data-month="2"]');await p.click('[data-date="2028-02-29"]');await p.fill('#edit-contentTop','オフライン予定');await p.fill('#edit-actualContent','オフライン実施');await p.selectOption('#edit-lower','2');await p.getByRole('button',{name:'保存する',exact:true}).click();
  await p.click('[data-view="summary"]');await p.click('#allowance-open');await p.fill('#allowance-paid','20');await p.fill('#allowance-hours','40');await p.getByRole('button',{name:'設定を保存',exact:true}).click();
  const ev=p.waitForEvent('download');await p.click('#backup');const download=await ev,stream=await download.createReadStream();let data='';for await(const chunk of stream)data+=chunk;assert.equal(JSON.parse(data).records['2028-02-29'].actualContent,'オフライン実施');
  await p.close();p=await context.newPage();attach(p);await p.goto(server.url+'index.html');await p.waitForFunction(()=>document.getElementById('offline-banner').dataset.state==='ready');assert.equal(await p.evaluate(()=>Planner.getRecords()['2028-02-29'].contentTop),'オフライン予定');assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('april-note.records.v1')).allowances['2027'].hours),40);
  // Offline JSON import remains local and preserves legacy fields and existing records.
  const old={app:'april-note',schemaVersion:1,records:{'2026-04-01':{upper:'',lower:'有',contentTop:'移動テスト',contentBottom:'旧下段',memoTop:'',memoBottom:''}}};await p.click('#import-open');await p.setInputFiles('#import-file',{name:'transfer.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))});await p.locator('#import-preview:not([hidden])').waitFor();await p.click('#import-confirm');assert.equal(await p.evaluate(()=>Object.keys(Planner.getRecords()).length),2);
  await p.evaluate(async()=>{const c=await caches.open('other-app-test');await c.put('other-app-marker',new Response('keep'));});
  // A broken new release must not replace the working offline cache.
  await context.setOffline(false);variant='B';broken=true;
  await p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
  await p.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration();return !r.installing&&!r.waiting;});
  assert.equal(await p.evaluate(async()=>{const keys=await caches.keys();return keys.some(k=>k.endsWith(':test-A'));}),true);
  assert.equal(await p.evaluate(async()=>{const keys=await caches.keys();return keys.some(k=>k.endsWith(':test-B'));}),false);
  await context.setOffline(true);await p.reload();await p.waitForFunction(()=>document.getElementById('offline-banner').dataset.state==='ready');assert.equal(await p.locator('body').getAttribute('data-test-version'),'A');
  // A complete release waits for consent and refuses to reload with an editor open.
  await context.setOffline(false);broken=false;variant='C';await p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});await p.locator('#offline-update:not([hidden])').waitFor();
  await p.selectOption('#fiscal-year','2027');await p.click('[data-month="2"]');await p.click('[data-date="2028-02-29"]');await p.fill('#edit-actualMemo','保存前');/* Invoke the guard directly: the modal also blocks normal background clicks. */await p.evaluate(()=>document.getElementById('offline-update').click());assert(dialogs.some(s=>s.includes('入力画面を保存して閉じて')));assert.equal(await p.locator('body').getAttribute('data-test-version'),'A');await p.getByRole('button',{name:'保存する',exact:true}).click();
  const navigation=p.waitForNavigation();await p.click('#offline-update');await navigation;await p.waitForFunction(()=>document.body.dataset.testVersion==='C');await p.waitForFunction(()=>document.getElementById('offline-banner').dataset.state==='ready');assert.equal(await p.evaluate(()=>Planner.getRecords()['2028-02-29'].actualMemo),'保存前');
  await context.setOffline(true);await p.reload();await p.waitForFunction(()=>document.getElementById('offline-banner').dataset.state==='ready');assert.equal(await p.locator('body').getAttribute('data-test-version'),'C');
  const cached=await p.evaluate(async()=>{const keys=(await caches.keys()).filter(key=>key.startsWith('april-note-shell:'));return (await Promise.all(keys.map(async key=>{const c=await caches.open(key);return(await c.keys()).map(r=>r.url);}))).flat();});assert.equal(cached.length,5);assert.equal(await p.evaluate(async()=>!!(await(await caches.open('other-app-test')).match('other-app-marker'))),true);assert(server.requests.every(r=>r.method==='GET'));assert(cached.every(url=>!url.includes('json')&&!url.includes('backup')));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  console.log('PASS offline cold launch, edit/persist, allowances, JSON backup/import, atomic install failure, consented update with unsaved-input protection, cache isolation and preserved records');
 }finally{await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
