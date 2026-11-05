const assert=require('node:assert/strict'),C=require('../core.js');
const p={heightCm:170,ageYears:40,referenceDate:'2026-11-04',nickname:''},r=C.record({date:'2026-11-04',weight:70,heightCm:170,ageYears:40});
assert.deepEqual([C.metrics(r,p).bmi,C.metrics(r,p).standard,C.metrics(r,p).degree],[24.22,63.58,10.1]);
assert.equal(C.metrics({...r,ageYears:17},p).degree,null);assert.equal(C.metrics({...r,heightCm:null}, {...p,heightCm:null}).bmi,null);
assert.equal(C.metrics(r,{...p,heightCm:180}).bmi,24.22);assert.equal(C.metrics({...r,ageYears:null,date:'2024-01-01'},{...p,ageYears:19}).adult,false);
assert.equal(C.validDate('2024-02-29'),true);assert.equal(C.validDate('2025-02-29'),false);assert.throws(()=>C.record({...r,weight:60.001}));assert.equal(C.record({...r,weight:60.05}).weight,60.05);
for(const [delta,mode] of [[1,'cloud'],[-1,'star'],[0.05,'flower']]){const s=C.empty();s.records['2026-11-03']={...r,date:'2026-11-03'};s.records[r.date]={...r,weight:70+delta};assert.equal(C.summary(s).trend,mode);assert.equal(C.monthly(s,2026)[0].average,null);assert.equal(C.summary(s).streak,2);}
assert.equal(Object.keys(C.validate(C.empty()).records).length,0);console.log('PASS formulas, adult eligibility, snapshots, dates, precision, character trends, missing months');
