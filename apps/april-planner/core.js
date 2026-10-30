/* Date-only calculations use UTC so daylight-saving and browser timezone do not move dates. */
(function(root){
'use strict';
const UPPER={'':'なし','遅':'遅参','早':'早退','振':'振替','子遅':'子の遅参','子早':'子の早退','A振':'AM振替','P振':'PM振替'};
const LOWER={'':'なし','有':'有給','夏':'夏季休暇','子':'子の看護','病':'病気休暇','出':'出張','喪':'喪休','1':'時間休 1時間','2':'時間休 2時間','3':'時間休 3時間','4':'時間休 4時間','5':'時間休 5時間','6':'時間休 6時間','7':'時間休 7時間'};
const FIELDS=['upper','lower','contentTop','contentBottom','memoTop','memoBottom','actualContent','actualMemo'];
const empty=()=>Object.fromEntries(FIELDS.map(k=>[k,'']));
const iso=d=>d.toISOString().slice(0,10);
function date(y,m,d){return new Date(Date.UTC(y,m-1,d));}
function valid(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const [y,m,d]=s.split('-').map(Number);return y>=2000&&y<=2099&&iso(date(y,m,d))===s;}
function fy(s){const [y,m]=s.split('-').map(Number);return m<4?y-1:y;}
function months(y){return Array.from({length:12},(_,i)=>({year:y+(i>=9?1:0),month:(i+3)%12+1}));}
function days(y,m){return date(y,m+1,0).getUTCDate();}
function fiscalDates(y){const result=[];for(const a of months(y))for(let d=1;d<=days(a.year,a.month);d++)result.push(iso(date(a.year,a.month,d)));return result;}
function holidays(y,provided={}){
 const h={};const add=(m,d,n)=>{h[iso(date(y,m,d))]=n;};
 const monday=(m,n)=>1+(8-date(y,m,1).getUTCDay())%7+(n-1)*7;
 add(1,1,'元日');add(1,monday(1,2),'成人の日');add(2,11,'建国記念の日');
 if(y>=2020)add(2,23,'天皇誕生日');else if(y<=2018)add(12,23,'天皇誕生日');
 add(3,Math.floor(20.8431+0.242194*(y-1980)-Math.floor((y-1980)/4)),'春分の日');
 add(4,29,y>=2007?'昭和の日':'みどりの日');add(5,3,'憲法記念日');if(y>=2007)add(5,4,'みどりの日');add(5,5,'こどもの日');
 if(y===2020){add(7,23,'海の日');add(7,24,'スポーツの日');add(8,10,'山の日');}
 else if(y===2021){add(7,22,'海の日');add(7,23,'スポーツの日');add(8,8,'山の日');}
 else{add(7,y>=2003?monday(7,3):20,'海の日');if(y>=2016)add(8,11,'山の日');add(10,monday(10,2),y>=2020?'スポーツの日':'体育の日');}
 add(9,y>=2003?monday(9,3):15,'敬老の日');add(9,Math.floor(23.2488+0.242194*(y-1980)-Math.floor((y-1980)/4)),'秋分の日');add(11,3,'文化の日');add(11,23,'勤労感謝の日');
 if(y===2019){add(5,1,'天皇の即位の日');add(10,22,'即位礼正殿の儀');}
 // Citizens' holidays are inserted before substitute holidays.
 for(let t=date(y,1,2);t<date(y,12,31);t.setUTCDate(t.getUTCDate()+1)){
  const s=iso(t);if(t.getUTCDay()!==0&&!h[s]&&h[iso(new Date(+t-86400000))]&&h[iso(new Date(+t+86400000))])h[s]='国民の休日';
 }
 for(const s of Object.keys(h).sort())if(new Date(s+'T00:00:00Z').getUTCDay()===0){let t=new Date(s+'T00:00:00Z');t.setUTCDate(t.getUTCDate()+1);if(y>=2007){while(h[iso(t)])t.setUTCDate(t.getUTCDate()+1);}if(!h[iso(t)])h[iso(t)]='振替休日';}
 // The uploaded workbook's explicit dates take priority over calculated dates.
 for(const [s,n] of Object.entries(provided))if(s.startsWith(y+'-'))h[s]=n;
 return h;
}
function validateRecord(r){
 if(!r||typeof r!=='object'||Array.isArray(r))throw Error('予定の形式が正しくありません。');
 const out=empty();for(const k of FIELDS){if(r[k]!==undefined&&typeof r[k]!=='string')throw Error('予定の入力値は文字列で指定してください。');out[k]=r[k]??'';if(out[k].length>10000)throw Error('入力は各欄10,000文字までです。');}
 if(!Object.hasOwn(UPPER,out.upper)||!Object.hasOwn(LOWER,out.lower))throw Error('未対応の休暇・振替区分が含まれています。');return out;
}
function meaningful(r){return FIELDS.some(k=>r[k]);}
function validateRecords(records){if(!records||typeof records!=='object'||Array.isArray(records))throw Error('予定データの形式が正しくありません。');const out={};if(Object.keys(records).length>37000)throw Error('データ件数が上限を超えています。');for(const [s,r] of Object.entries(records)){if(!valid(s))throw Error('不正な日付: '+s);const v=validateRecord(r);if(meaningful(v))out[s]=v;}return out;}
function totals(records,year,month){
 const t={paid:0,sick:0,child:0,summer:0,trip:0,mourning:0,late:0,early:0,childLate:0,childEarly:0,substitute:0,am:0,pm:0,hourCount:0,hours:0,childHourCount:0,childHours:0,registered:0};
 const upper={遅:'late',早:'early',子遅:'childLate',子早:'childEarly',振:'substitute',A振:'am',P振:'pm'},lower={有:'paid',病:'sick',子:'child',夏:'summer',出:'trip',喪:'mourning'};
 for(const [s,r] of Object.entries(records)){
  if(fy(s)!==year||(month&&Number(s.slice(5,7))!==month))continue;
  t.registered++;if(upper[r.upper])t[upper[r.upper]]++;if(lower[r.lower])t[lower[r.lower]]++;
  if(/^[1-7]$/.test(r.lower)){const child=['子遅','子早'].includes(r.upper);t[child?'childHourCount':'hourCount']++;t[child?'childHours':'hours']+=Number(r.lower);}
 }return t;
}
function comparison(r){
 const planned=!!(r.contentTop?.trim()||r.memoTop?.trim()),actual=!!(r.actualContent?.trim()||r.actualMemo?.trim());
 if(planned&&actual)return (r.contentTop||'').trim()===(r.actualContent||'').trim()&&(r.memoTop||'').trim()===(r.actualMemo||'').trim()?'予定と同じ内容':'予定・実施に差分あり';
 return planned?'実施未記録':actual?'実施のみ記録':'予定・実施未記録';
}
const defaultAllowance=()=>({paid:null,sick:null,child:null,summer:null,mourning:null,hours:null,childHours:null,hoursPerDay:8,hoursDeductPaid:false,childHoursDeductChild:false});
function validateAllowances(value){
 if(value===undefined)return {};if(!value||typeof value!=='object'||Array.isArray(value))throw Error('休暇設定の形式が正しくありません。');const out={};
 for(const [year,p] of Object.entries(value)){
  if(!/^\d{4}$/.test(year)||+year<1999||+year>2099||!p||typeof p!=='object'||Array.isArray(p))throw Error('休暇設定の年度を確認してください。');
  const a=defaultAllowance();for(const key of ['paid','sick','child','summer','mourning','hours','childHours'])if(p[key]!==undefined&&p[key]!==null){if(typeof p[key]!=='number'||!Number.isFinite(p[key])||p[key]<0||p[key]>10000)throw Error('付与日数・上限は0〜10000で設定してください。');a[key]=p[key];}
  if(p.hoursPerDay!==undefined){if(!Number.isInteger(p.hoursPerDay)||p.hoursPerDay<1||p.hoursPerDay>24)throw Error('1日の時間数は1〜24の整数にしてください。');a.hoursPerDay=p.hoursPerDay;}
  for(const key of ['hoursDeductPaid','childHoursDeductChild']){if(p[key]!==undefined&&typeof p[key]!=='boolean')throw Error('差し引き設定が正しくありません。');a[key]=p[key]??false;}out[year]=a;
 }return out;
}
function usage(t,p=defaultAllowance()){
 const d=p.hoursPerDay,paidRemaining=p.paid===null?null:p.paid-t.paid-(p.hoursDeductPaid?t.hours/d:0),childRemaining=p.child===null?null:p.child-t.child-(p.childHoursDeductChild?t.childHours/d:0);
 let hoursRemaining=p.hours===null?null:p.hours-t.hours,childHoursRemaining=p.childHours===null?null:p.childHours-t.childHours;
 if(p.hoursDeductPaid&&paidRemaining!==null&&hoursRemaining!==null)hoursRemaining=Math.min(hoursRemaining,paidRemaining*d);
 if(p.childHoursDeductChild&&childRemaining!==null&&childHoursRemaining!==null)childHoursRemaining=Math.min(childHoursRemaining,childRemaining*d);
 return {paidUsed:t.paid+(p.hoursDeductPaid?t.hours/d:0),childUsed:t.child+(p.childHoursDeductChild?t.childHours/d:0),paidRemaining,childRemaining,hoursRemaining,childHoursRemaining};
}

const api={comparison,defaultAllowance,validateAllowances,usage,UPPER,LOWER,FIELDS,empty,iso,date,valid,fy,months,days,fiscalDates,holidays,validateRecord,validateRecords,meaningful,totals};root.PlannerCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
