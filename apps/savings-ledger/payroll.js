(function(root){'use strict';
const ALIASES={gross:['総支給額','総支給金額','支給総額','支給合計額','支給額合計','支給合計'],deductions:['控除金額合計','控除額合計','控除合計額','総控除額','控除総額','控除合計','控除金額'],net:['差引支給額','差引支給金額','差引金額','手取金額','手取り額','手取り'],zaikei:['財形貯蓄','財形貯金','一般財形','財形積立','財形'],account1:['口座1','口座 1','第1口座','第1振込','振込金額1','振込額1','第1'],account2:['口座2','口座 2','第2口座','第2振込','振込金額2','振込額2','第2'],account3:['口座3','口座 3','第3口座','第3振込','振込金額3','振込額3','第3']};
const LINE_LABELS=['共済掛金・長期','共済掛金・短期','共済掛金・介護','厚生会費','所得税','住民税','厚生年金','県共済積立','労働組合費','自治労共済掛金','通勤手当','時間外勤務手当','超過勤務手当'];
function norm(t){return String(t||'').normalize('NFKC').replace(/[\u00a0\u3000]/g,' ');}
function amounts(t){return [...t.matchAll(/(?:[−△▲-]\s*)?\d{1,3}(?:[,，]\d{3})+(?:円)?|(?:[−△▲-]\s*)?\d+(?:円)?/g)].map(m=>({value:Number(m[0].replace(/[円,，\s]/g,'').replace(/[−△▲]/g,'-')),index:m.index,raw:m[0]}));}
function findLabel(line,names){let best=null;for(const name of names){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').split('').join('\\s*'),m=new RegExp(escaped).exec(line);if(m&&(!best||m[0].length>best.length))best={index:m.index,end:m.index+m[0].length,length:m[0].length,label:m[0]};}return best;}
function parse(text,filename=''){
 const lines=norm(text).split(/\r?\n/).map(s=>s.trim()).filter(Boolean),values={},evidence={},warnings=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i],labels=Object.entries(ALIASES).map(([field,names])=>({field,hit:findLabel(line,names)})).filter(x=>x.hit).sort((a,b)=>a.hit.index-b.hit.index);
  for(let j=0;j<labels.length;j++){
   const {field,hit}=labels[j],end=labels[j+1]?.hit.index??line.length,after=line.slice(hit.end,end);let candidates=amounts(after);
   if(candidates.length===1){const value=candidates[0].value;if(values[field]!==undefined&&values[field]!==value){values[field]=null;warnings.push(field+'の金額候補が複数あります。');}else if(values[field]!==null){values[field]=value;evidence[field]=line;}}
   else if(candidates.length>1)warnings.push(field+'の近くに複数の金額があります。確認してください。');
  }
  // Header-only rows are paired with an immediately following numeric row only when cardinality agrees.
  if(labels.length&&labels.every(({hit},j)=>amounts(line.slice(hit.end,labels[j+1]?.hit.index??line.length)).length===0)&&lines[i+1]){
   const below=amounts(lines[i+1]);if(below.length===labels.length&&/^[-△▲−\d\s,，円¥￥|:：.]+$/.test(lines[i+1]))labels.forEach(({field},j)=>{if(values[field]===undefined){values[field]=below[j].value;evidence[field]=line+'\n'+lines[i+1];}});
  }
 }
 function periods(t){const out=[];for(const m of norm(t).matchAll(/令和\s*(元|\d{1,2})\s*年\s*(\d{1,2})\s*月|R\s*(\d{1,2})[.年/\-]\s*(\d{1,2})|((?:20)\d{2})[年/\-.]\s*(\d{1,2})(?:月|[/\-.]\d{1,2}|\b)/gi)){const y=m[1]?2018+(m[1]==='元'?1:Number(m[1])):m[3]?2018+Number(m[3]):Number(m[5]),mo=Number(m[2]||m[4]||m[6]);if(y>=2000&&y<2100&&mo>=1&&mo<=12)out.push(`${y}-${String(mo).padStart(2,'0')}`);}return [...new Set(out)];}
 const fileMonths=periods(filename),bodyMonths=periods(text);let month=fileMonths.length===1?fileMonths[0]:bodyMonths.length===1?bodyMonths[0]:'';if(fileMonths.length===1&&bodyMonths.length&&bodyMonths.some(m=>m!==fileMonths[0])){warnings.push('ファイル名と本文の年月候補が異なります。対象月を確認してください。');month='';}
 if(bodyMonths.length>1)warnings.push('本文に複数の年月があります。対象月を確認してください。');
 const kind=/差額|追給|遡及/.test(filename)?'adjustment':/賞与|期末|勤勉|ボーナス/.test(filename)?'bonus':/給与/.test(filename)?'salary':/差額支給明細/.test(text)?'adjustment':/賞与明細|賞与支給/.test(text)?'bonus':'salary';
 const details={};for(let i=0;i<lines.length;i++)for(const label of LINE_LABELS){const hit=findLabel(lines[i],[label]);if(!hit)continue;const a=amounts(lines[i].slice(hit.end));if(a.length===1)details[label]=a[0].value;}
 return {month,kind,gross:values.gross??null,deductions:values.deductions??null,net:values.net??null,zaikei:values.zaikei??null,accounts:[values.account1??null,values.account2??null,values.account3??null],source:filename,lines:details,evidence,warnings:[...new Set(warnings)]};
}
function pdfLines(items){const rows=[],byY=new Map();for(const item of items){if(!item.str)continue;const y=item.transform[5];const bucket=Math.round(y/2);let row=byY.get(bucket);if(!row){row={y,items:[]};rows.push(row);byY.set(bucket,row);}row.items.push(item);}return rows.sort((a,b)=>b.y-a.y).map(r=>r.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str).join('  ')).join('\n');}
root.PayrollParser={parse,pdfLines};if(typeof module!=='undefined')module.exports=root.PayrollParser;
})(typeof window!=='undefined'?window:globalThis);
