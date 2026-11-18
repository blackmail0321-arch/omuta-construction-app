/* Reuse the same controls and editing state in a canvas-first workspace. */
(function(){'use strict';
if(new URLSearchParams(location.search).get('layout')==='classic')return;
const $=id=>document.getElementById(id),make=(tag,attrs={},text)=>{const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;return e;};
document.body.classList.add('cad-workspace');const main=document.querySelector('main'),article=main.querySelector('article'),aside=main.querySelector('aside'),sections=[...aside.querySelectorAll(':scope > section')],header=document.querySelector('header');
const rail=make('nav',{id:'workspace-rail','aria-label':'加工する項目'}),drawer=make('aside',{id:'workspace-drawer',hidden:'','aria-label':'操作パネル'}),heading=make('div',{class:'workspace-drawer-heading'}),title=make('h2',{id:'workspace-panel-title'}),close=make('button',{id:'workspace-close',type:'button','aria-label':'操作パネルを閉じて図面へ戻る'},'× 図面へ');heading.append(title,close);drawer.append(heading);const panels={};
const icons={open:'M3 7h7l2 3h9v10H3z M3 7V4h7l2 3',extract:'M4 4h16v16H4z M7 10h10 M10 7v10',text:'M4 5h16 M12 5v15 M8 20h8',draw:'M4 20l4-1L20 7l-3-3L5 16z',layers:'M12 3L2 9l10 6 10-6z M3 14l9 5 9-5 M3 18l9 5 9-5',view:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9v6 M9 12h6',scale:'M3 5h18v14H3z M7 5v5 M11 5v3 M15 5v5 M19 5v3',save:'M4 3h14l3 3v15H3V3z M7 3v7h10V3 M7 21v-7h10v7',help:'M9 8a3 3 0 116 0c0 3-3 2-3 5 M12 17v1'};
const labels={open:'図面を開く',extract:'取り込む',text:'文字',draw:'選択・描く',layers:'レイヤー',view:'表示',scale:'実寸',save:'保存・JW',help:'使い方'};
for(const[key,label]of Object.entries(labels)){const p=make('section',{'data-workspace-panel':key,hidden:''});panels[key]=p;drawer.append(p);const b=make('button',{'data-panel':key,title:label,'aria-label':label,'aria-expanded':'false','aria-controls':'workspace-drawer',type:'button'});b.innerHTML='<svg viewBox="0 0 24 26" aria-hidden="true"><path d="'+icons[key]+'"/></svg>';b.append(make('span',{},label));b.onclick=()=>open(key);rail.append(b);}
main.prepend(rail);main.append(drawer);
function move(id,key){const e=$(id);if(e)panels[key].append(e);}
// Keep the top-level file picker within easy reach, and put reopen choices in a panel.
const headerControls=header.lastElementChild;const sourceLabel=$('pdf').closest('label');sourceLabel.classList.add('workspace-open-file');const headerHelp=make('button',{type:'button',id:'workspace-help-top',title:'操作ガイド','aria-label':'使い方・操作ガイド'},'？');headerHelp.onclick=()=>open('help');
for(const id of ['work-open','save-local'])move(id,id==='work-open'?'open':'save');panels.open.append($('project-file').closest('label'));headerControls.append(sourceLabel,$('check-update'),headerHelp);
const openIntro=make('p',{},'PDF・TIFF・画像を開きます。保存したJSONは「作業を再開」、端末内の保存は「この端末の作業を開く」です。');panels.open.prepend(openIntro);const openButton=make('button',{type:'button',class:'primary'},'PDF・TIFF・画像を選ぶ');openButton.onclick=()=>$('pdf').click();panels.open.prepend(openButton);
// Page, source and resolution controls remain grouped with file loading.
const first=sections[0];for(const id of ['page','quality']){const e=$(id).closest('label');panels.open.append(e);}move('resolution','open');move('source','open');panels.extract.append(first);
// Text choices and editor.
const include=$('include-text').closest('label');panels.text.append(include,make('p',{},'オンにすると、元の線を取り込む時にも文字を追加します。線を取り込んだ後に、下のボタンで文字だけ追加することもできます。'));panels.text.append($('text-controls'));
// The drawing palette is no longer permanently laid over the drawing.
move('palette','draw');move('tools-help','draw');panels.draw.append(sections[1]);
const settings=$('palette-settings');panels.layers.append(settings);settings.open=true;move('layers','layers');
const view=document.querySelector('.view-tools'),zoomTools=make('div',{id:'workspace-zoom','aria-label':'表示倍率'});for(const id of ['zoom-out','fit','zoom-in'])zoomTools.append($(id));panels.view.append(view,document.querySelector('.emphasis-controls'));
// Split scale calibration from export without duplicating any field IDs.
const save=sections[2],scaleStart=save.querySelector('h3'),end=$('export-check');let cursor=scaleStart;while(cursor&&cursor!==end){const next=cursor.nextElementSibling;panels.scale.append(cursor);cursor=next;}panels.save.append(save);
for(const id of ['quick-guide','load-guide','local-status','update-status'])move(id,'help');const privacy=document.querySelector('.privacy');panels.help.append(privacy);const lastHelp=article.querySelector(':scope > details');if(lastHelp)panels.help.append(lastHelp);const classic=make('a',{href:'?layout=classic',class:'button'},'従来の一覧表示を開く');panels.help.append(classic);
// Short instructions stay available in the draw panel; canvas chrome stays small.
for(const id of ['mode-instruction','selection-guidance','tool-state'])move(id,'draw');for(const e of [...article.querySelectorAll(':scope > .hint')])panels.help.append(e);
const hud=make('div',{id:'workspace-hud'}),current=make('span',{id:'workspace-current'},'道具：選択'),back=make('button',{type:'button',title:'ひとつ戻す'},'↶ 戻す'),clear=make('button',{type:'button',title:'選択を解除'},'選択解除');back.onclick=()=>$('undo').click();clear.onclick=()=>$('clear-selection').click();const backgroundToggle=make('button',{type:'button',id:'workspace-background-toggle',title:'原本の重ね表示を切り替える'});backgroundToggle.onclick=()=>{$('background').checked=!$('background').checked;$('background').dispatchEvent(new Event('change'));sync();};function sync(){backgroundToggle.textContent=$('background').checked?'原本ON':'原本OFF';backgroundToggle.setAttribute('aria-pressed',String($('background').checked));}sync();hud.append(current,back,clear,backgroundToggle,zoomTools);
const footer=make('div',{id:'workspace-footer',role:'status'});const message=make('p',{id:'workspace-message'});message.textContent=$('status').textContent;panels.help.prepend(make('h3',{},'直前の操作結果'),message);footer.setAttribute('tabindex','0');footer.setAttribute('aria-label','操作結果の詳細を開く');footer.onclick=()=>open('help');footer.onkeydown=e=>{if(e.key==='Enter')open('help')};footer.append($('status'));article.prepend(hud);article.append(footer);main.replaceChildren(rail,article,drawer);aside.remove();
let active=null;
function open(key){if(!panels[key])return;const same=active===key&&!drawer.hidden;hide();if(same)return;active=key;drawer.hidden=false;panels[key].hidden=false;title.textContent=labels[key];const b=rail.querySelector('[data-panel="'+key+'"]');b.classList.add('active');b.setAttribute('aria-expanded','true');drawer.scrollTop=0;}
function hide(){drawer.hidden=true;for(const p of Object.values(panels))p.hidden=true;for(const b of rail.querySelectorAll('button')){b.classList.remove('active');b.setAttribute('aria-expanded','false')}active=null;}
$('check-update').addEventListener('click',()=>open('help'));close.onclick=hide;document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!drawer.hidden){const key=active;hide();rail.querySelector('[data-panel="'+key+'"]')?.focus()}});
// Choosing a canvas operation returns to the full drawing; the mode is retained.
drawer.addEventListener('click',e=>{if(e.target.closest('[data-mode],#crop,#calibrate')){setTimeout(()=>{current.textContent='道具：'+($('palette-current').textContent||'選択');hide()},0)}});
const observer=new MutationObserver(()=>{current.textContent='道具：'+$('palette-current').textContent});observer.observe($('palette-current'),{childList:true,subtree:true,characterData:true});
window.CadWorkspace={open,hide,sync,openForTarget(id){const p=$(id)?.closest('[data-workspace-panel]');if(p)open(p.dataset.workspacePanel)},setStatus(text){footer.title=text;message.textContent=text;}};
new ResizeObserver(()=>window.dispatchEvent(new Event('cad-workspace-fit'))).observe($('viewport'));
const empty=make('div',{id:'workspace-empty'});empty.append(make('strong',{},'図面を大きく開いて、必要なところだけ加工。'),make('p',{},'上の「図面を開く」からPDF・TIFF・画像を選んでください。左のアイコンで操作を選べます。'));article.append(empty);
const watch=new MutationObserver(()=>{empty.hidden=$('drawing').hasAttribute('viewBox')});watch.observe($('drawing'),{attributes:true,attributeFilter:['viewBox']});
})();
