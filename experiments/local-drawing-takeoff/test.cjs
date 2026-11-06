'use strict';
const assert=require('node:assert/strict'),{crop,findSameSymbol,maskFromRGBA}=require('./matcher.cjs');
const image={width:180,height:100,data:new Uint8Array(180*100)};
function symbol(x,y){for(let k=2;k<=12;k++){image.data[(y+2)*image.width+x+k]=1;image.data[(y+12)*image.width+x+k]=1;image.data[(y+k)*image.width+x+2]=1;image.data[(y+k)*image.width+x+12]=1;image.data[(y+k)*image.width+x+k]=1;}}
symbol(10,10);symbol(60,10);symbol(110,55);
// Different shapes must not be treated as copies just because they contain ink.
for(let k=0;k<14;k++)image.data[(50+k)*image.width+30+k]=1;
const template=crop(image,{x:10,y:10,width:15,height:15}),result=findSameSymbol(image,template,{minimumCoverage:.98,minimumScore:.95});assert.equal(result.candidateCount,3);assert.deepEqual(result.matches.map(m=>[m.x,m.y]),[[10,10],[60,10],[110,55]]);assert.equal(result.truncated,false);
const limited=findSameSymbol(image,template,{maxPositions:10});assert.equal(limited.truncated,true);assert.equal(limited.scannedPositions,10);assert(limited.candidateCount<3);
assert.throws(()=>findSameSymbol(image,{width:3,height:3,data:new Uint8Array(9)}),/white margin/);assert.throws(()=>crop(image,{x:-1,y:0,width:5,height:5}),/outside/);
const rgba={width:2,height:1,data:new Uint8ClampedArray([0,0,0,255,0,0,0,0])};assert.deepEqual([...maskFromRGBA(rgba).data],[1,0]);
console.log('PASS synthetic same-symbol locations and count, nonmatching shape, duplicate suppression, partial-search flag, bounded inputs and transparent pixels. Real drawings and iPad performance remain unverified.');
