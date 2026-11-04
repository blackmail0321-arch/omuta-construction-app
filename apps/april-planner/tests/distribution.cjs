const {chromium}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path');
const {startTestServer}=require('./test-server.cjs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const server=process.env.OMUTA_PLANNER_URL?null:await startTestServer(path.resolve(__dirname,'..'));
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,acceptDownloads:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(process.env.OMUTA_PLANNER_URL||server.url);
  assert.deepEqual(await page.evaluate(()=>window.PLANNER_INITIAL.records),{});
  assert.equal(await page.evaluate(()=>window.PLANNER_INITIAL.importedDays),0);
  assert.deepEqual(await page.evaluate(()=>Planner.getRecords()),{});
  assert.deepEqual(await page.locator('#month-tabs button').allTextContents(),['4月','5月','6月','7月','8月','9月','10月','11月','12月','1月','2月','3月']);
  await page.selectOption('#fiscal-year','2027');await page.click('[data-month="2"]');await page.click('[data-date="2028-02-29"]');
  await page.fill('#edit-contentTop','テスト予定');await page.fill('#edit-memoTop','テストメモ');await page.click('#plan-to-actual');await page.fill('#edit-actualContent','テスト実施：変更あり');await page.selectOption('#edit-lower','2');await page.getByRole('button',{name:'保存する',exact:true}).click();
  await page.reload();const saved=await page.evaluate(()=>Planner.getRecords()['2028-02-29']);
  assert.equal(saved.contentTop,'テスト予定');assert.equal(saved.actualContent,'テスト実施：変更あり');assert.equal(saved.contentBottom,'');
  await page.selectOption('#fiscal-year','2027');await page.click('[data-view="annual"]');assert.match(await page.locator('#annual-content').innerText(),/予定・実施に差分あり/);
  await page.click('[data-view="summary"]');await page.click('#allowance-open');await page.fill('#allowance-paid','20');await page.fill('#allowance-hours','40');await page.check('#allowance-hoursDeductPaid');await page.getByRole('button',{name:'設定を保存',exact:true}).click();
  assert.match(await page.locator('#paid-balance').innerText(),/19日 6時間/);assert.match(await page.locator('#stat-hour-count').innerText(),/38時間 利用可/);
  const downloadEvent=page.waitForEvent('download');await page.click('#backup');const download=await downloadEvent,stream=await download.createReadStream();let json='';for await(const chunk of stream)json+=chunk;const data=JSON.parse(json);
  assert.equal(data.schemaVersion,2);assert.equal(data.allowances['2027'].paid,20);assert.equal(data.records['2028-02-29'].actualContent,'テスト実施：変更あり');
  const older={app:'april-note',schemaVersion:1,records:{'2026-04-01':{upper:'',lower:'有',contentTop:'旧版のテスト予定',contentBottom:'旧下段テスト',memoTop:'',memoBottom:''}}};
  await page.click('#import-open');await page.setInputFiles('#import-file',{name:'old.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(older))});await page.locator('#import-preview:not([hidden])').waitFor();await page.click('#import-confirm');
  assert.equal(await page.evaluate(()=>Planner.getRecords()['2026-04-01'].actualContent),'');assert.equal(await page.evaluate(()=>Planner.getRecords()['2026-04-01'].contentBottom),'旧下段テスト');
  await page.click('[data-view="search"]');await page.fill('#search-year','2028');await page.selectOption('#search-month','2');await page.selectOption('#search-day','29');await page.getByRole('button',{name:'検索する'}).click();assert.match(await page.locator('.results-heading').innerText(),/1日/);
  await page.click('[data-view="calendar"]');assert.equal(await page.locator('#leave-status').isVisible(),false);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  console.log('PASS empty distribution, April fiscal order, leap day, plan/actual save/reload, yearly allowances, JSON backup, old import preservation and mobile navigation');
 }finally{await browser.close();if(server)await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
