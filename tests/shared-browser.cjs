/* Real PostgREST/PostgreSQL integration with a local mock of Supabase Auth only. */
const {chromium,expect}=require('playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {start}=require('./shared-test-gateway.cjs');
(async()=>{
 const gateway=await start();gateway.sql('truncate public.shared_projects cascade;');
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const contexts=[];const errors=[];
 async function page(viewport={width:1280,height:900}){const context=await browser.newContext({acceptDownloads:true,viewport});contexts.push(context);const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept('端末共有の検証用工事'));return p;}
 async function loginEditor(p){await p.goto(gateway.url+'/index.html');await p.fill('#shared-email','owner@example.test');await p.fill('#shared-password','local-test-only');await p.locator('#shared-login button').click();await expect(p.locator('#shared-controls')).toBeVisible();}
 async function api(user,name,body={}){const response=await fetch(gateway.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{Authorization:'Bearer '+gateway.jwt(gateway.users[user+'@example.test']),'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};}
 try{
  const pc=await page();await loginEditor(pc);await pc.click('#shared-close');await pc.locator('[data-view="estimate"]').first().click();await pc.click('#wb-new');
  await pc.locator('[data-view="docs"]').first().click();await pc.click('#sub-contract');await pc.fill('#sc-contract','2026-10-01');await pc.fill('#sc-start','2026-10-02');await pc.fill('#sc-amount','12345678');await pc.check('#sc-checked');await pc.click('#sc-save');
  await pc.click('[data-sub-edit="3"]');await pc.selectOption('#sd-state','差戻し');await pc.fill('#sd-note','原本の記載を確認');await pc.click('#sd-save');
  await pc.evaluate(()=>{WB.project().settings.privateMarker='FINANCE-SECRET';WB.mutate('検証','共有の確認');});
  await pc.getByRole('button',{name:'端末間共有',exact:true}).click();await pc.click('#shared-publish');await expect(pc.locator('#shared-message')).toContainText('共有しました');
  const list=await api('owner','shared_list_projects');assert.equal(list.status,200);assert.equal(list.data.length,1);const id=list.data[0].id;
  await pc.fill('#shared-member-email','viewer@example.test');await pc.locator('#shared-members button[type="submit"]').click();await expect(pc.locator('#shared-message')).toContainText('権限を設定');await pc.click('#shared-close');
  const mobile=await page({width:390,height:844});await mobile.goto(gateway.url+'/shared/status.html');await mobile.fill('#email','viewer@example.test');await mobile.fill('#password','local-test-only');await mobile.locator('#login button').click();await expect(mobile.locator('#rows')).toContainText('原本の記載を確認');
  if(process.env.OMUTA_SCREENSHOT_DIR){fs.mkdirSync(process.env.OMUTA_SCREENSHOT_DIR,{recursive:true});await mobile.screenshot({path:path.join(process.env.OMUTA_SCREENSHOT_DIR,'mobile-status.png')});}
  assert.equal(await mobile.evaluate(()=>typeof window.WB),'undefined');assert.equal(await mobile.locator('#rows button,#rows input').count(),0);assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const snapshot=await api('viewer','shared_get_status',{p_id:id,p_month:'2026-10'});assert.equal(snapshot.status,200);const localRows=await pc.evaluate(()=>SUBMISSIONS.master.map(d=>({no:d.no,state:SUBMISSIONS.state(WB.project(),d),due_date:SUBMISSIONS.due(WB.project(),d)||null,applicability:SUBMISSIONS.applicability(WB.project(),d)})));assert.deepEqual(snapshot.data.rows.map(({no,state,due_date,applicability})=>({no,state,due_date,applicability})),localRows);assert(!JSON.stringify(snapshot.data).includes('FINANCE-SECRET'));assert(!JSON.stringify(snapshot.data).includes('12345678'));
  assert.equal((await api('viewer','shared_get_project',{p_id:id})).status,403);assert.equal((await api('viewer','shared_save_project',{p_id:id,p_local_id:'x',p_project:{},p_expected_revision:1})).status,403);
  assert.equal((await api('outsider','shared_get_status',{p_id:id,p_month:'2026-10'})).status,403);
  console.log('PASS PC publication -> mobile read-only status; viewer/outsider forbidden APIs; financial redaction');
  const ipad=await page({width:820,height:1180});await loginEditor(ipad);
  let download=ipad.waitForEvent('download');await ipad.getByRole('button',{name:'共有版を取り込んで編集'}).click();await(await download).path();
  await expect(ipad.locator('#shared-dialog')).not.toBeVisible();assert.equal(await ipad.evaluate(()=>WB.project().submissionRecords['3'].note),'原本の記載を確認');
  await pc.click('[data-sub-edit="3"]');await pc.fill('#sd-note','PCで更新した提出状況');await pc.click('#sd-save');
  await expect.poll(async()=>(await api('owner','shared_get_project',{p_id:id})).data.revision,{timeout:10000}).toBe(2);
  await mobile.click('#refresh');await expect(mobile.locator('#rows')).toContainText('PCで更新した提出状況');
  await ipad.evaluate(()=>{WB.project().submissionRecords['3'].note='iPadの未送信変更';WB.mutate('検証','同時更新');});
  await expect(ipad.locator('.shared-sync')).toContainText('他の端末で更新',{timeout:10000});
  assert.equal((await api('owner','shared_get_project',{p_id:id})).data.project.submissionRecords['3'].note,'PCで更新した提出状況');
  assert.equal(await ipad.evaluate(()=>WB.project().submissionRecords['3'].note),'iPadの未送信変更');
  await ipad.getByRole('button',{name:'端末間共有',exact:true}).click();await ipad.click('#shared-list-refresh');
  download=ipad.waitForEvent('download');await ipad.getByRole('button',{name:'共有版を取り込んで編集'}).click();const backup=await download;const backupData=JSON.parse(fs.readFileSync(await backup.path(),'utf8'));assert(backupData.projects.some(p=>p.submissionRecords?.['3']?.note==='iPadの未送信変更'));
  await expect(ipad.locator('#shared-dialog')).not.toBeVisible();assert.equal(await ipad.evaluate(()=>WB.project().submissionRecords['3'].note),'PCで更新した提出状況');
  await ipad.getByRole('button',{name:'端末間共有',exact:true}).click();download=ipad.waitForEvent('download');await ipad.click('#shared-recovery');await(await download).path();assert.equal(await ipad.evaluate(()=>WB.project().submissionRecords['3'].note),'iPadの未送信変更');assert.equal((await api('owner','shared_get_project',{p_id:id})).data.project.submissionRecords['3'].note,'PCで更新した提出状況');await ipad.click('#shared-close');
  console.log('PASS iPad imports with backup; auto sync; stale revision rejected; unsent data retained and backed up');
  await pc.route('**/rest/v1/rpc/shared_save_project',route=>route.abort('failed'));
  await pc.evaluate(()=>{WB.project().submissionRecords['3'].note='通信復旧後の変更';WB.mutate('検証','オフライン');});
  await expect(pc.locator('.shared-sync')).toContainText('接続できません',{timeout:10000});assert.equal(await pc.evaluate(()=>WB.project().submissionRecords['3'].note),'通信復旧後の変更');
  assert.equal((await api('owner','shared_get_project',{p_id:id})).data.revision,2);
  await pc.unroute('**/rest/v1/rpc/shared_save_project');await pc.getByRole('button',{name:'端末間共有',exact:true}).click();await pc.click('#shared-publish');await expect(pc.locator('#shared-message')).toContainText('共有しました');
  await expect.poll(async()=>(await api('owner','shared_get_project',{p_id:id})).data.revision).toBe(3);
  await mobile.evaluate(()=>{for(let i=0;i<sessionStorage.length;i++){const key=sessionStorage.key(i);if(key.startsWith('omuta-shared-session:')){const session=JSON.parse(sessionStorage.getItem(key));session.expires_at=0;sessionStorage.setItem(key,JSON.stringify(session));}}});
  const before=gateway.refreshCount();await mobile.reload();await expect(mobile.locator('#rows')).toContainText('通信復旧後の変更');assert(gateway.refreshCount()>before);
  await mobile.route('**/rest/v1/rpc/shared_get_status',route=>route.abort('failed'));await mobile.click('#refresh');await expect(mobile.locator('#status-message')).toContainText('最新状態を取得できていません');await expect(mobile.locator('#rows')).toContainText('通信復旧後の変更');await mobile.unroute('**/rest/v1/rpc/shared_get_status');
  await pc.fill('#shared-member-email','viewer@example.test');await pc.click('#shared-revoke');await expect(pc.locator('#shared-message')).toContainText('共有を解除');await mobile.click('#refresh');await expect(mobile.locator('#status-message')).toContainText('共有されている工事はありません');assert.equal(await mobile.locator('#rows article').count(),0);assert.equal((await api('viewer','shared_get_status',{p_id:id,p_month:'2026-10'})).status,403);
  await mobile.click('#logout');await expect(mobile.locator('#login')).toBeVisible();assert.equal(await mobile.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('omuta-shared-session:')).length),0);
  console.log('PASS offline retention/retry, stale-status warning, session refresh, access revocation and logout clearing');
  const phoneEntry=await page({width:390,height:844});await phoneEntry.goto(gateway.url+'/index.html');await phoneEntry.waitForURL('**/shared/status.html');assert.equal(await phoneEntry.evaluate(()=>typeof window.WB),'undefined');
  assert.deepEqual(errors,[]);console.log('PASS phone routes to status-only page; no page errors');
 }finally{await browser.close();gateway.server.closeAllConnections();await new Promise(resolve=>gateway.server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1});
