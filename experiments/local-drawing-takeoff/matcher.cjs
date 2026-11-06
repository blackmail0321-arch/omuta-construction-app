/* Experimental local symbol matching. Not part of the deployed runtime. */
'use strict';
function validate(image){if(!image||!Number.isInteger(image.width)||!Number.isInteger(image.height)||image.width<1||image.height<1||image.width*image.height>12000000||!image.data||image.data.length!==image.width*image.height)throw Error('Invalid bounded binary image');}
function maskFromRGBA(image,threshold=160){if(!image||image.data?.length!==image.width*image.height*4)throw Error('Invalid RGBA image');const result={width:image.width,height:image.height,data:new Uint8Array(image.width*image.height)};validate(result);for(let k=0;k<result.data.length;k++){const j=k*4;result.data[k]=image.data[j+3]>32&&(image.data[j]*.299+image.data[j+1]*.587+image.data[j+2]*.114)<threshold?1:0;}return result;}
function crop(image,box){validate(image);const {x,y,width,height}=box;if(![x,y,width,height].every(Number.isInteger)||x<0||y<0||width<1||height<1||x+width>image.width||y+height>image.height)throw Error('Crop outside image');const data=new Uint8Array(width*height);for(let row=0;row<height;row++)data.set(image.data.subarray((y+row)*image.width+x,(y+row)*image.width+x+width),row*width);return {width,height,data};}
function iou(a,b){const w=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)),h=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));return w*h/(a.width*a.height+b.width*b.height-w*h);}
function findSameSymbol(image,template,{minimumCoverage=.85,minimumScore=.8,maxPositions=200000,maxCandidates=2000}={}){
 validate(image);validate(template);if(template.width*template.height>4096)throw Error('Prototype template limit exceeded');if(template.width>image.width||template.height>image.height)throw Error('Template larger than image');if(!Number.isFinite(minimumCoverage)||minimumCoverage<0||minimumCoverage>1||!Number.isFinite(minimumScore)||minimumScore<0||minimumScore>1||!Number.isSafeInteger(maxPositions)||maxPositions<1||!Number.isSafeInteger(maxCandidates)||maxCandidates<1)throw Error('Invalid search limits');
 const foreground=[],background=[];for(let y=0;y<template.height;y++)for(let x=0;x<template.width;x++)(template.data[y*template.width+x]?foreground:background).push([x,y]);if(foreground.length<5||background.length<5)throw Error('Choose a symbol with a white margin');
 const candidates=[],totalPositions=(image.width-template.width+1)*(image.height-template.height+1);let scannedPositions=0,truncated=false;
 outer:for(let y=0;y<=image.height-template.height;y++)for(let x=0;x<=image.width-template.width;x++){
  if(scannedPositions>=maxPositions){truncated=true;break outer;}scannedPositions++;
  let hits=0;for(const [dx,dy] of foreground)hits+=image.data[(y+dy)*image.width+x+dx]?1:0;const coverage=hits/foreground.length;if(coverage<minimumCoverage)continue;
  let stray=0;for(const [dx,dy] of background)stray+=image.data[(y+dy)*image.width+x+dx]?1:0;const similarity=coverage-.65*stray/background.length;if(similarity<minimumScore)continue;
  candidates.push({x,y,width:template.width,height:template.height,similarity});if(candidates.length>=maxCandidates){truncated=true;break outer;}
 }
 candidates.sort((a,b)=>b.similarity-a.similarity||a.y-b.y||a.x-b.x);const matches=[];for(const candidate of candidates)if(!matches.some(kept=>iou(candidate,kept)>.25))matches.push(candidate);matches.sort((a,b)=>a.y-b.y||a.x-b.x);
 return {matches,candidateCount:matches.length,truncated,scannedPositions,totalPositions,meaning:'Similar-symbol locations only; not confirmed quantities, probability, equipment classification or complete takeoff.'};
}
module.exports={maskFromRGBA,crop,findSameSymbol};
