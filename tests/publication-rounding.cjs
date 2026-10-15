// Run with Playwright available and the integrated app served at OMUTA_TEST_URL.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
(async()=>{
 const output=fs.mkdtempSync(path.join(os.tmpdir(),'omuta-rounding-'));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try {
 for(const book of [0,1])for(const purpose of ['設計用','予算用']){
  const p=await browser.newPage({acceptDownloads:true});const errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  p.on('dialog',d=>d.type()==='prompt'?d.accept('計算検証用工事'):d.accept());
  await p.goto(process.env.OMUTA_TEST_URL||'http://127.0.0.1:8013');
  await p.locator('[data-view="estimate"]').first().click();await p.click('#wb-copy');
  await p.locator('[data-wb-edit]').first().click();
  const panel=p.locator('.price-match-panel');assert.equal(await panel.count(),1);
  assert.match(await panel.locator('summary').innerText(),/押して/);
  await panel.locator('summary').focus();await p.keyboard.press('Enter');assert.equal(await panel.getAttribute('open'),'');
  await p.keyboard.press('Enter');assert.equal(await panel.getAttribute('open'),null);
  await p.fill('#pub-price-'+book,'28800');await p.selectOption('#pub-kind-'+book,'材料価格');await p.click('[data-pub-apply="'+book+'"]');
  await p.fill('#wi-maker','Panasonic');await p.fill('#wi-maker-price','6800');
  await p.fill('#wi-reduction','36');await p.fill('#wi-material-rate','5');
  await p.fill('#wi-electric-coeff','0');await p.fill('#wi-ordinary-coeff','0');await p.fill('#wi-labor-rate','0');
  await p.selectOption('#wi-rounding','100');await p.fill('#wi-quantity','4');
  await p.fill('#wi-evidence','検証用の仮入力');await p.fill('#wi-reason','画像例の計算検証');
  await p.check('#wi-price-check');await p.check('#wi-quantity-check');await p.click('#wi-adopt');
  const c=await p.evaluate(()=>WB.calc(WB.adopted()[0]));
  assert.equal(c.materialBase,2448);assert.equal(c.material,2570);assert.equal(c.intermediate,2570);assert.equal(c.unit,31300);
  const cases=await p.evaluate(()=>{const i=WB.adopted()[0];return [1,10,100,1000].map(unitRounding=>WB.calc({...i,unitRounding}).unit)});
  assert.deepEqual(cases,[31370,31370,31300,31000]);
  const controls=await p.evaluate(()=>{const i=WB.adopted()[0];return {
   direct:WB.calc({...i,mode:'direct',unitPrice:31370,directRoundingApplied:true}).unit,
   noPublication:WB.calc({...i,priceReference:{...i.priceReference,type:'メーカー資料'},quote:6800}).unit,
   zero:WB.calc({...i,priceReference:{...i.priceReference,manufacturerPrice:0}}).unit,
  }});assert.equal(controls.direct,31300);assert.equal(controls.noPublication,2500);assert.equal(controls.zero,28800);
  const before=await p.evaluate(()=>JSON.stringify(WB.project().items));await p.evaluate(()=>{WB.project().settings.referenceRevision=7;WB.project().settings.commonChecked=true;WB.project().approval={snapshot:'old'};WB.record('検証','旧計算版');});await p.reload();assert.equal(await p.evaluate(()=>WB.calc(WB.adopted()[0]).unit),31300);assert.equal(await p.evaluate(()=>JSON.stringify(WB.project().items)),before);assert.equal(await p.evaluate(()=>WB.project().approval),null);assert.equal(await p.evaluate(()=>WB.project().settings.commonChecked),false);
  await p.evaluate(purpose=>{
   const original=WB.project(),item=WB.adopted()[0];
   const dummy=Array.from({length:13},(_,k)=>({...structuredClone(item),id:'test-'+k,mode:'direct',unitPrice:100,unitRounding:1,directRoundingApplied:true,priceReference:{type:'メーカー資料'},publicationPrices:{}}));
   WB.restoreProject({...structuredClone(original),items:[...dummy,item],settings:{...original.settings,purpose,durationMonths:3,budget:purpose==='予算用'?20:0},approval:null});
  },purpose);
  await p.locator('[data-view="estimate"]').first().click();await p.click('[data-wb-tab="output"]');
  const wait=p.waitForEvent('download');await p.click('#wb-export');await(await wait).saveAs(path.join(output,`${book}-${purpose==='予算用'?'budget':'design'}.xlsx`));
  assert.equal(errors.length,0);await p.close();
  console.log('PASS',book,purpose,'J=2448; S上段=2570; S下段=31300; rounding and keyboard controls');
 }
 console.log('OUTPUT_DIR='+output);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
