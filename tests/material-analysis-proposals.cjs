const A=require('../apps/integrated-v0.13/integrated/material-analysis-core.js'),assert=require('node:assert/strict');
const d=(text,role='design')=>({id:'doc',name:'数量根拠.pdf',analysis:{role,text}}),g=text=>A.analyze({documents:[d(text)]}).groups[0];
let r=g('照明器具 A402\n数量\n18台');assert.equal(r.quantity,18);assert.equal(r.quantityCandidates[0].quantity,18);assert.equal(r.quantityCandidates[0].source.file,'数量根拠.pdf');assert.match(r.quantityCandidates[0].source.quote,/数量 18台/);
r=g('照明器具 A402\n数量 12台');assert.equal(r.quantity,12);r=g('照明器具 A402\n18台');assert.equal(r.quantity,null);assert.equal(r.quantityCandidates.length,0);
r=g('照明器具 A402 数量18台 または20台');assert.equal(r.quantity,null);assert.deepEqual(r.quantityCandidates.map(x=>x.quantity),[18,20]);assert.equal(r.unit,'台');assert(r.quantityCandidates.every(x=>x.status.includes('未確認')));
r=g('既設 照明器具 A402 数量8灯');assert.equal(r.operation,'既設');assert.equal(r.quantity,8);assert.match(r.operationReasons[0],/既設/);
r=A.analyze({documents:[d('照明器具 A402 数量3台','existing')]}).groups[0];assert.equal(r.operation,'既設');assert.match(r.operationReasons[0],/既存内訳書/);
r=g('照明器具 A402 5000lm');assert.equal(r.quantity,null);assert.equal(r.quantityCandidates.length,0);
r=g('照明器具 A402 数量-3台');assert.equal(r.quantity,null);assert.equal(r.quantityCandidates.length,0);console.log('PASS explicit adjacent quantity labels with provenance, unlabelled nearby counts never guessed, ambiguous quantities remain candidate choices, lamp unit and classification reasons, no lumens/negative count fabrication');

r=g('照明器具 A402\n数量：\n12台');assert.equal(r.quantity,12);

r=g('照明器具 A402 数量'+('9'.repeat(400))+'台');assert.equal(r.quantity,null);assert.equal(r.quantityCandidates.length,0);
