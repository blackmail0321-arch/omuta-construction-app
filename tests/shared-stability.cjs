const {chromium}=require('playwright');const assert=require('node:assert/strict');const path=require('node:path');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
for(const scenario of ['same-reordered','different','stale-list']){
 const p=await browser.newPage();await p.route('http://localhost:8058/**',r=>r.fulfill({contentType:'text/html',body:'<div class="app"></div>'}));await p.goto('http://localhost:8058');
 await p.evaluate(scenario=>{
  window.scenario=scenario;window.saves=0;window.gets=0;window.lists=0;window.revision=1;
  window.local={id:'local',role:'current',title:'工事',settings:{durationMonths:3,location:'入力済み'},items:[{id:'a',quantity:3},{id:'b',quantity:4}],submissionRecords:{'5':{status:'確認済み',confirmedAt:'2026-10-28'}}};
  const reverse=x=>Array.isArray(x)?x.map(reverse):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).reverse().map(k=>[k,reverse(x[k])])):x;
  window.remote=reverse(local);if(scenario==='different')remote.submissionRecords['5'].status='提出済';
  localStorage.setItem('omuta-shared-links:test:owner',JSON.stringify({local:{id:'remote',revision:1,blocked:scenario!=='stale-list',hash:'legacy'}}));
  window.WB={project:()=>local,projects:()=>[local],validProject:()=>true,localSaved:()=>true,adopted:p=>p.items,totals:()=>({rawDirect:4260400})};
  window.OmutaShared={SharedError:Error,SharedClient:class{
   constructor(){this.url='test';this.session={user:{id:'owner'}}}configured(){return true}async access(){return 'editor'}
   async list(){lists++;if(scenario==='stale-list'&&lists===2)return new Promise(resolve=>{window.releaseOld=()=>resolve([{id:'remote',title:'古い一覧',can_edit:true,revision:1,updated_at:new Date().toISOString()}])});return [{id:'remote',title:'共有',can_edit:true,revision:scenario==='stale-list'?revision:2,updated_at:new Date().toISOString()}]}
   async get(){gets++;return {project:remote,revision:2}}async save(){saves++;revision=2;return {id:'remote',revision:2}}
  }};
 },scenario);
 const before=await p.evaluate(()=>JSON.stringify(local));await p.addScriptTag({path:path.resolve('shared/web/shared-editor.js')});
 await p.waitForFunction(()=>!document.querySelector('#shared-controls').hidden);
 if(scenario==='same-reordered'){
  await p.waitForFunction(()=>JSON.parse(localStorage.getItem('omuta-shared-links:test:owner')).local.hash!=='legacy');
  const l=await p.evaluate(()=>JSON.parse(localStorage.getItem('omuta-shared-links:test:owner')).local);assert.equal(l.blocked,false);assert.equal(l.revision,2);assert.equal(await p.evaluate(()=>saves),0);assert.match(await p.locator('#shared-message').innerText(),/同じ内容/);
  await p.click('#shared-resolve');await p.waitForFunction(()=>document.querySelector('#shared-message').textContent.includes('更新は不要'));assert.equal(await p.evaluate(()=>saves),0);
 }else if(scenario==='different'){
  await p.waitForFunction(()=>document.querySelector('#shared-message').textContent.includes('異なる内容'));
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('omuta-shared-links:test:owner')).local.blocked),true);assert.equal(await p.evaluate(()=>saves),0);
 }else{
  await p.waitForFunction(()=>lists===1);await p.click('#shared-list-refresh');await p.waitForFunction(()=>typeof releaseOld==='function');
  await p.click('#shared-publish');await p.waitForFunction(()=>saves===1&&lists===3);await p.evaluate(()=>releaseOld());await p.waitForTimeout(100);
  const l=await p.evaluate(()=>JSON.parse(localStorage.getItem('omuta-shared-links:test:owner')).local);assert.equal(l.revision,2);assert.equal(l.blocked,false);
 }
 assert.equal(await p.evaluate(()=>JSON.stringify(local)),before);console.log('PASS stability',scenario);await p.close();
}
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
