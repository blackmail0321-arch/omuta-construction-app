/* PDF.js 6.x constructPath DrawOPS. Conservative stroked-path importer.
   Text, fills and images remain in the original; never infer fixture identity. */
(function(root){'use strict';
const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const point=(m,x,y)=>({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]});
function extract(list,OPS,viewport,{width,height,region=null,core=root.CadDraft}={}){
 let state={m:[1,0,0,1,0,0],dash:[],phase:0,skip:false,alpha:1,clips:[],white:false},stack=[],pendingClip=false,segments=[],skipped=0,curves=0,work=0;
 const strokes=new Set(['stroke','closeStroke','fillStroke','eoFillStroke','closeFillStroke','closeEOFillStroke'].map(k=>OPS[k]));
 const limit=()=>{if(++work>1000000||segments.length>12000)throw Error('元の線が多すぎます。必要な範囲を指定してからお試しください（上限12000本）。');};
 const rect=r=>[{x:r[0],y:r[1]},{x:r[2],y:r[1]},{x:r[2],y:r[3]},{x:r[0],y:r[3]}];
 const frame=rect([0,0,width,height]),clip=region?rect([Math.min(region.x1,region.x2),Math.min(region.y1,region.y2),Math.max(region.x1,region.x2),Math.max(region.y1,region.y2)]):frame;
 // Rectangular clipping is supported. Other clips are omitted until restore
 // rather than importing hidden geometry or misinterpreting compound holes.
 for(let i=0;i<list.fnArray.length;i++){
  limit();const op=list.fnArray[i],a=list.argsArray[i]||[];
  if(op===OPS.save||op===OPS.paintFormXObjectBegin||op===OPS.beginGroup){stack.push(structuredClone(state));if(op===OPS.paintFormXObjectBegin){if(a[0])state.m=mul(state.m,a[0]);if(a[1])state.clips.push(rect(a[1]).map(p=>point(mul(viewport.transform,state.m),p.x,p.y)));}else if(op===OPS.beginGroup)state.skip=true;continue}
  if(op===OPS.restore||op===OPS.paintFormXObjectEnd||op===OPS.endGroup){state=stack.pop()||{m:[1,0,0,1,0,0],dash:[],phase:0,skip:false,alpha:1,clips:[],white:false};pendingClip=false;continue}
  if(op===OPS.transform){state.m=mul(state.m,a);continue}
  if(op===OPS.setStrokeRGBColor){state.white=a[0]==='#ffffff';continue}
  if(op===OPS.setDash){state.dash=Array.from(a[0]||[]);state.phase=a[1]||0;continue}
  if(op===OPS.setGState){for(const[k,v]of a[0]||[]){if(k==='CA')state.alpha=v;else if(k==='D'){state.dash=Array.from(v[0]);state.phase=v[1]||0}else if(k==='SMask'&&v||k==='BM'&&v!=='source-over'&&v!=='Normal')state.skip=true;}continue}
  if(op===OPS.clip||op===OPS.eoClip){pendingClip=true;continue}
  if(op!==OPS.constructPath)continue;
  const [paint,data]=a,buf=data?.[0];
  if(strokes.has(paint)&&buf){
   if(state.skip||state.alpha<=0||state.white){skipped++;}else{
    const m=mul(viewport.transform,state.m);let cursor=null,start=null,di=0,left=0,dashes=state.dash.filter(v=>Number.isFinite(v)&&v>=0);if(dashes.length%2)dashes=dashes.concat(dashes);const total=dashes.reduce((s,v)=>s+v,0);if(!total)dashes=[];
    const resetDash=()=>{di=0;left=dashes[0]||0;if(dashes.length){let phase=((state.phase%total)+total)%total,guard=0;while(phase>=left&&guard++<dashes.length*2){phase-=left;di=(di+1)%dashes.length;left=dashes[di]}left-=phase;}};
    const add=(p,q)=>{limit();const row={id:0,type:'line',layer:'review',x1:p.x,y1:p.y,x2:q.x,y2:q.y};let rows=core.cropGeometry([row],clip,0,0).entities;if(region)rows=core.cropGeometry(rows,frame,0,0).entities;for(const polygon of state.clips)rows=core.cropGeometry(rows,polygon,0,0).entities;segments.push(...rows.filter(e=>Math.hypot(e.x2-e.x1,e.y2-e.y1)>1e-6));};
    const line=(q)=>{if(!cursor){cursor=q;return}const p=cursor,dist=Math.hypot(q.x-p.x,q.y-p.y);if(dashes.length&&dist){let used=0;while(used<dist-1e-9){limit();if(left<1e-9){di=(di+1)%dashes.length;left=dashes[di];continue}const len=Math.min(left,dist-used),at=t=>point(m,p.x+(q.x-p.x)*t/dist,p.y+(q.y-p.y)*t/dist);if(di%2===0)add(at(used),at(used+len));used+=len;left-=len}}else add(point(m,p.x,p.y),point(m,q.x,q.y));cursor=q;};
    const cubic=(p,b,c,q,depth=0)=>{const mapped=[p,b,c,q].map(v=>point(m,v.x,v.y)),distance=(v)=>{const[a,,,z]=mapped,dx=z.x-a.x,dy=z.y-a.y;const t=Math.max(0,Math.min(1,((v.x-a.x)*dx+(v.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(v.x-a.x-t*dx,v.y-a.y-t*dy)};if(depth>=12||Math.max(distance(mapped[1]),distance(mapped[2]))<=.5){line(q);return}const mid=(x,y)=>({x:(x.x+y.x)/2,y:(x.y+y.y)/2}),ab=mid(p,b),bc=mid(b,c),cd=mid(c,q),abc=mid(ab,bc),bcd=mid(bc,cd),center=mid(abc,bcd);cubic(p,ab,abc,center,depth+1);cubic(center,bcd,cd,q,depth+1)};
    for(let j=0;j<buf.length;){limit();const cmd=buf[j++];if(cmd===0){cursor={x:buf[j++],y:buf[j++]};start={...cursor};resetDash()}else if(cmd===1)line({x:buf[j++],y:buf[j++]});else if(cmd===2){const b={x:buf[j++],y:buf[j++]},c={x:buf[j++],y:buf[j++]},q={x:buf[j++],y:buf[j++]};if(cursor){curves++;cubic({...cursor},b,c,q)}}else if(cmd===3){const b={x:buf[j++],y:buf[j++]},q={x:buf[j++],y:buf[j++]};if(cursor){curves++;cubic({...cursor},{x:cursor.x+2*(b.x-cursor.x)/3,y:cursor.y+2*(b.y-cursor.y)/3},{x:q.x+2*(b.x-q.x)/3,y:q.y+2*(b.y-q.y)/3},q)}}else if(cmd===4){if(start)line({...start})}else throw Error('このPDFの線形式には対応していません。画像からの抽出をお使いください。');}
   }
  }
  if(pendingClip){let polygon=[],valid=!!buf;for(let j=0;buf&&j<buf.length;){const cmd=buf[j++];if(cmd===0&&polygon.length){valid=false;break}if(cmd===0||cmd===1)polygon.push({x:buf[j++],y:buf[j++]});else if(cmd!==4){valid=false;break}}if(polygon.length===5&&polygon[0].x===polygon[4].x&&polygon[0].y===polygon[4].y)polygon.pop();const xs=new Set(polygon.map(p=>p.x)),ys=new Set(polygon.map(p=>p.y));if(valid&&polygon.length===4&&xs.size===2&&ys.size===2&&polygon.every((p,i)=>{const q=polygon[(i+1)%4];return (p.x===q.x)!==(p.y===q.y)}))state.clips.push(polygon.map(p=>point(mul(viewport.transform,state.m),p.x,p.y)));else state.skip=true;pendingClip=false;}
 }
 if(segments.length>12000)throw Error('元の線が12000本を超えます。範囲を絞ってください。');
 return {entities:segments.map((e,i)=>({...e,id:i+1})),skipped,curves};
}
const api={extract};if(typeof module==='object')module.exports=api;else root.CadPDFVectors=api;
})(typeof globalThis!=='undefined'?globalThis:this);
