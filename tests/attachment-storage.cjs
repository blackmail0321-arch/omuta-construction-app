const {chromium}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),http=require('node:http');
(async()=>{
 const server=http.createServer((q,r)=>r.end('<!doctype html><title>storage test</title>')).listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
 const source=fs.readFileSync('apps/integrated-v0.13/integrated/submissions.js','utf8');
 const storage=source.slice(source.indexOf('let dbPromise;'),source.indexOf('\nconst download='));
 await page.addScriptTag({content:storage+'\nwindow.storageTest={database,blobAction};'});
 const result=await page.evaluate(async()=>{
  const {database,blobAction}=window.storageTest;const db=await database();
  await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(new Blob(['旧添付'],{type:'text/plain'}),'legacy');tx.oncomplete=resolve;tx.onerror=reject;});
  const legacy=await(await blobAction('get','legacy')).text();
  const put=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(value,key){if(value instanceof Blob)throw Error('Blob storage rejected');return put.call(this,value,key);};
  await blobAction('put','new',new File(['新しい添付\u0000'],'test.txt',{type:'text/plain'}));
  const read=await blobAction('get','new');const bytes=await read.text();const type=read.type;
  await blobAction('delete','new');const removed=(await blobAction('get','new'))===undefined;
  IDBObjectStore.prototype.put=function(value,key){const request=put.call(this,value,key);this.transaction.abort();return request;};
  let aborted=false;try{await blobAction('put','abort',new Blob(['x']));}catch(e){aborted=e.message.includes('ファイル保存に失敗');}
  return {legacy,bytes,type,removed,aborted};
 });
 assert.deepEqual(result,{legacy:'旧添付',bytes:'新しい添付\u0000',type:'text/plain',removed:true,aborted:true});
 console.log('PASS byte-backed upload/read/delete, legacy Blob compatibility, rejected Blob simulation and transaction abort');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
