function u16(a,p){return a[p]|a[p+1]<<8}function u32(a,p){return (a[p]|a[p+1]<<8|a[p+2]<<16|a[p+3]<<24)>>>0}
async function unzipSimple(a){let e=-1;for(let i=a.length-22;i>=0&&i>a.length-70000;i--)if(u32(a,i)===0x06054b50){e=i;break}if(e<0)throw Error('ZIP EOCD not found');let n=u16(a,e+10),p=u32(a,e+16),files={};for(let k=0;k<n;k++){if(u32(a,p)!==0x02014b50)throw Error('ZIP central');let method=u16(a,p+10),cs=u32(a,p+20),us=u32(a,p+24),nl=u16(a,p+28),xl=u16(a,p+30),cl=u16(a,p+32),off=u32(a,p+42),name=new TextDecoder().decode(a.slice(p+46,p+46+nl));let lnl=u16(a,off+26),lxl=u16(a,off+28),data=a.slice(off+30+lnl+lxl,off+30+lnl+lxl+cs);if(method===0)files[name]=data;else if(method===8){let ds=new DecompressionStream('deflate-raw');files[name]=new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer())}else throw Error('ZIP method '+method);p+=46+nl+xl+cl}return files}
let crcTable=null;function crc32(a){if(!crcTable){crcTable=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0}}let c=0xffffffff;for(let b of a)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0}
function push16(o,v){o.push(v&255,(v>>>8)&255)}function push32(o,v){o.push(v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255)}
function zipStore(files){
// 大容量XLSXでも配列の spread を使わず、Uint8Array.set で連結する安定版。
let enc=new TextEncoder(),locals=[],centrals=[],offset=0;
for(let [name,data] of Object.entries(files)){
 if(!(data instanceof Uint8Array))data=new Uint8Array(data);
 let nb=enc.encode(name),crc=crc32(data);
 let h=[];push32(h,0x04034b50);push16(h,20);push16(h,0x800);push16(h,0);push16(h,0);push16(h,33);push32(h,crc);push32(h,data.length);push32(h,data.length);push16(h,nb.length);push16(h,0);
 let hb=new Uint8Array(h),local=new Uint8Array(hb.length+nb.length+data.length);local.set(hb,0);local.set(nb,hb.length);local.set(data,hb.length+nb.length);locals.push(local);
 let c=[];push32(c,0x02014b50);push16(c,20);push16(c,20);push16(c,0x800);push16(c,0);push16(c,0);push16(c,33);push32(c,crc);push32(c,data.length);push32(c,data.length);push16(c,nb.length);push16(c,0);push16(c,0);push16(c,0);push16(c,0);push32(c,name.endsWith('/')?16:0);push32(c,offset);
 let cb=new Uint8Array(c),central=new Uint8Array(cb.length+nb.length);central.set(cb,0);central.set(nb,cb.length);centrals.push(central);offset+=local.length;
}
let cdSize=centrals.reduce((n,a)=>n+a.length,0),totalLocal=locals.reduce((n,a)=>n+a.length,0);
let e=[];push32(e,0x06054b50);push16(e,0);push16(e,0);push16(e,Object.keys(files).length);push16(e,Object.keys(files).length);push32(e,cdSize);push32(e,totalLocal);push16(e,0);let eb=new Uint8Array(e);
let out=new Uint8Array(totalLocal+cdSize+eb.length),pos=0;for(let a of locals){out.set(a,pos);pos+=a.length}for(let a of centrals){out.set(a,pos);pos+=a.length}out.set(eb,pos);return out
}