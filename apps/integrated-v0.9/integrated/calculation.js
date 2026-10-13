/* Evaluate the supplied electrical formulas; no eval or generated code. */
(()=>{'use strict';
const trees=new Map();
const round=(v,n=0)=>{const f=10**n;return Math.sign(v)*Math.round((Math.abs(v)+Number.EPSILON*Math.abs(v))*f)/f;};
function syntax(formula){
 if(trees.has(formula))return trees.get(formula);
 const tokens=formula.replace(/^=/,'').match(/"(?:[^"]|"")*"|\$?[A-Z]+\$?\d+|\d+(?:\.\d*)?(?:[Ee][+-]?\d+)?|[A-Z]+|<=|>=|<>|[+\-*/^=<>(),:]/g)||[];let at=0;
 const precedence={'=':1,'<>':1,'<':1,'>':1,'<=':1,'>=':1,'+':2,'-':2,'*':3,'/':3,'^':4};
 function expr(min=0){let x,token=tokens[at++];
  if(token==='+'||token==='-')x={op:'unary'+token,a:expr(4)};
  else if(token==='('){x=expr();if(tokens[at++]!==')')throw Error('閉じ括弧がありません');}
  else if(token?.startsWith('"'))x={value:token.slice(1,-1).replace(/""/g,'"')};
  else if(/^\d/.test(token||''))x={value:Number(token)};
  else if(/^\$?[A-Z]+\$?\d+$/.test(token||'')){x={ref:token.replace(/\$/g,'')};if(tokens[at]===':'){at++;x={range:[x.ref,tokens[at++].replace(/\$/g,'')]};}}
  else if(tokens[at]==='('){at++;const args=[];if(tokens[at]!==')')do{args.push(expr());if(tokens[at]!==',')break;at++;}while(true);if(tokens[at++]!==')')throw Error('関数の閉じ括弧がありません');x={fn:token,args};}
  else throw Error('未対応の数式要素：'+token);
  while(precedence[tokens[at]]>=min){const op=tokens[at++],p=precedence[op];x={op,a:x,b:expr(p+(op==='^'?0:1))};}return x;
 }
 const result=expr();if(at!==tokens.length)throw Error('未対応の数式：'+formula);trees.set(formula,result);return result;
}
const pos=r=>{let c=0;for(const v of r.match(/[A-Z]+/)[0])c=c*26+v.charCodeAt(0)-64;return [c,Number(r.match(/\d+/)[0])];};
const col=n=>{let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;};
function calculate(inputs){
 const cache={...inputs},busy=new Set();
 const get=ref=>{if(Object.hasOwn(cache,ref))return cache[ref];if(busy.has(ref))throw Error('循環参照：'+ref);const c=WB_CALC_MODEL[ref];if(!c)return undefined;busy.add(ref);const value=c.f?visit(syntax(c.f)):c.v;busy.delete(ref);cache[ref]=value;return value;};
 const number=v=>Number(v||0);
 function visit(x){
  if(Object.hasOwn(x,'value'))return x.value;if(x.ref)return get(x.ref);
  if(x.range){const a=pos(x.range[0]),b=pos(x.range[1]),rows=[];for(let r=a[1];r<=b[1];r++){const row=[];for(let c=a[0];c<=b[0];c++)row.push(get(col(c)+r));rows.push(row);}return rows;}
  if(x.op){const a=visit(x.a);if(x.op==='unary+')return number(a);if(x.op==='unary-')return -number(a);const b=visit(x.b);switch(x.op){case '+':return number(a)+number(b);case '-':return number(a)-number(b);case '*':return number(a)*number(b);case '/':return number(a)/number(b);case '^':return number(a)**number(b);case '=':return a===b;case '<>':return a!==b;case '<':return a<b;case '>':return a>b;case '<=':return a<=b;case '>=':return a>=b;}}
  if(x.fn==='IF')return visit(x.args[visit(x.args[0])?1:2]);
  const a=x.args.map(visit),nums=a.flat(Infinity).filter(v=>typeof v==='number');
  switch(x.fn){case 'AND':return a.every(Boolean);case 'MIN':return Math.min(...nums);case 'MEDIAN':{nums.sort((a,b)=>a-b);const n=nums.length;return n%2?nums[(n-1)/2]:(nums[n/2-1]+nums[n/2])/2;}
   case 'ROUND':return round(number(a[0]),number(a[1]));case 'INT':return Math.floor(Number(number(a[0]).toPrecision(15)));case 'EXP':return Math.exp(number(a[0]));case 'LN':return Math.log(number(a[0]));case 'LOG':return Math.log(number(a[0]))/Math.log(a[1]===undefined?10:number(a[1]));
   case 'HLOOKUP':{const k=a[1][0].findIndex(v=>v===a[0]);if(k<0)throw Error('共通費の採用区分が見つかりません');return a[1][number(a[2])-1][k];}
   default:throw Error('未対応の関数：'+x.fn);
  }
 }
 const common=get('BC9'),management=get('BC10'),general=get('BC11');if(![common,management,general].every(Number.isFinite))throw Error('共通費の計算条件を確認してください');
 return {common,management,general,method:get('BC8'),rates:[get('AU9'),get('AU10'),get('AU11')],get,cache};
}
window.SourceCalculation={calculate,round,basis:'予算設計書・電気設備（令和8年9月変更）'};
})();
