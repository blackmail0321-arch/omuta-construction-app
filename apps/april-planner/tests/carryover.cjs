const assert=require('node:assert/strict'),C=require('../core.js');
const r=(lower,upper='')=>({...C.empty(),lower,upper});
const p=C.validateAllowances({2026:{paid:40,paidCarry:20,hoursDeductPaid:true,hoursPerDay:8}})[2026];
let records={'2026-04-01':r('有'),'2026-05-01':r('4'),'2026-06-01':r('3','子遅'),'2027-03-31':r('有'),'2027-04-01':r('有')};
let c=C.carryover(records,2026,p,'2026-11-12');assert.equal(c.expiry,'2027-03-31');assert.equal(c.consumed,1.5);assert.equal(c.remaining,18.5);assert.equal(c.planned,1);assert.equal(c.atRisk,17.5);assert.equal(c.expired,false);
c=C.carryover(records,2026,p,'2027-03-31');assert.equal(c.consumed,2.5);assert.equal(c.planned,0);assert.equal(c.daysLeft,0);assert.equal(c.expired,false);
c=C.carryover(records,2026,p,'2027-04-01');assert.equal(c.expired,true);assert.equal(c.remaining,17.5);
assert.equal(C.carryover(records,2026,{...p,hoursDeductPaid:false},'2026-11-12').consumed,1);
assert.equal(C.carryover(records,2026,C.defaultAllowance(),'2026-11-12').configured,false);
assert.equal(C.carryover(records,2026,{...p,paidCarry:0},'2026-11-12').atRisk,0);
assert.equal(C.carryover(records,2026,{...p,paidCarry:1},'2026-11-12').remaining,0);
assert.equal(C.usage(C.totals(records,2026),p).paidRemaining,37.5); // carry is included in total, never added twice
assert.throws(()=>C.validateAllowances({2026:{paid:20,paidCarry:21}}));assert.throws(()=>C.validateAllowances({2026:{paidCarry:-1}}));
assert.equal(C.validateAllowances({2026:{paid:40}})[2026].paidCarry,null);
const restored=C.validateAllowances(JSON.parse(JSON.stringify({2026:p})));assert.equal(restored[2026].paidCarry,20);
for(const lower of ['有','夏','子','病','喪','1','7'])assert(C.isLeave(r(lower)));
assert(C.isLeave(r('','P振')));assert(!C.isLeave(r('出')));assert(!C.isLeave(r('','遅')));
console.log('PASS carryover March-31 expiry, FIFO, past versus future, fractional time, child exclusion, fiscal boundary, validation and backup compatibility; red leave classification');
