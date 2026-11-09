/* Native disclosure panels keep the existing form nodes and in-progress inputs intact. */
(()=>{'use strict';
const root=document.getElementById('assist');
const headings=[...root.querySelectorAll('h3')];
const find=text=>headings.find(h=>h.textContent.replace(/^1\.\s*/,'').trim()===text)?.parentElement;
const reading=find('PDF・写真の文字を読み取る'),takeoff=document.getElementById('drawing-takeoff');
// The takeoff tool was inserted into the OCR panel; expose it as its own top-level title.
if(reading&&takeoff&&reading.contains(takeoff))reading.after(takeoff);
for(const title of ['資料を蓄積して、まとめて分析する','Excelの明細をまとめて取り込む','PDF・写真の文字を読み取る','図面の器具を数える（確認付き）','取り込んだ資料','追加する機器を選ぶ']){
 const panel=find(title);if(!panel)continue;
 const details=document.createElement('details');details.className='assist-folder';
 const summary=document.createElement('summary');summary.textContent=title;details.append(summary);
 panel.before(details);details.append(panel);panel.classList.add('assist-folder-body');
 panel.querySelector(':scope > h3').hidden=true;
}
let number=0;
for(const section of root.children){const title=section.querySelector(':scope > summary')||section.querySelector(':scope > h3');if(title)title.textContent=(++number)+'. '+title.textContent.replace(/^\d+\.\s*/,'');}
window.ASSIST_FOLDERS={open(target){for(let e=target;e&&e!==root;e=e.parentElement)if(e.tagName==='DETAILS')e.open=true;}};
})();
