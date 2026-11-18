(function(root){'use strict';
function extract(content,viewport,{width,height,region=null,core=root.CadDraft}={}){
 const m=viewport.transform,map=(x,y)=>({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]}),scale=Math.hypot(m[0],m[1]),entities=[];let skipped=0;
 const frame=[{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}],r=region,poly=r?[{x:Math.min(r.x1,r.x2),y:Math.min(r.y1,r.y2)},{x:Math.max(r.x1,r.x2),y:Math.min(r.y1,r.y2)},{x:Math.max(r.x1,r.x2),y:Math.max(r.y1,r.y2)},{x:Math.min(r.x1,r.x2),y:Math.max(r.y1,r.y2)}]:frame;
 for(const item of content.items){if(typeof item.str!=='string'||!item.str.trim())continue;if(item.dir==='ttb'||!item.transform?.every(Number.isFinite)){skipped++;continue}const t=item.transform,p=map(t[4],t[5]),h=Math.hypot(m[0]*t[2]+m[2]*t[3],m[1]*t[2]+m[3]*t[3]),w=Math.abs(item.width)*scale,rotation=Math.atan2(m[1]*t[0]+m[3]*t[1],m[0]*t[0]+m[2]*t[1])*180/Math.PI,text=item.str.replace(/[\x00-\x1f\x7f]/g,' ');if(h<=0||w<=0||text.length>1000){skipped++;continue}const e={id:0,type:'text',layer:'text',x1:p.x,y1:p.y,text,width:w,height:h,rotation};if(!core.cropGeometry([e],poly,0,0).entities.length||!core.cropGeometry([e],frame,0,0).entities.length){skipped++;continue}entities.push({...e,id:entities.length+1});}
 return {entities,skipped};
}
let mapping;
function encodeDXF(value){
 if(/^[\x00-\x7f]*$/.test(value))return new TextEncoder().encode(value);
 if(!mapping){mapping=new Map();for(let i=0;i<128;i++)mapping.set(String.fromCharCode(i),[i]);const decoder=new TextDecoder('shift_jis',{fatal:true});for(let i=0xa1;i<=0xdf;i++)mapping.set(decoder.decode(Uint8Array.of(i)),[i]);for(let lead=0x81;lead<=0xfc;lead++){if(lead>0x9f&&lead<0xe0)continue;for(let trail=0x40;trail<=0xfc;trail++){if(trail===0x7f)continue;try{const c=decoder.decode(Uint8Array.of(lead,trail));if(c.length===1&&!mapping.has(c))mapping.set(c,[lead,trail]);}catch(_){}}}}
 const out=[],missing=new Set();for(const c of value){const b=mapping.get(c);if(b)out.push(...b);else missing.add(c)}if(missing.size)throw Error('JW用の文字コードで保存できない文字があります：'+[...missing].slice(0,12).join(' ')+'。「文字をDXFに含める」をオフにするか、該当文字を編集してください。');return new Uint8Array(out);
}
const api={extract,encodeDXF};if(typeof module==='object')module.exports=api;else root.CadPDFText=api;
})(typeof globalThis!=='undefined'?globalThis:this);
