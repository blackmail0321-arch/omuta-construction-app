/* Field-level feedback for decisions; optional source citations remain optional. */
(()=>{'use strict';
 const $=id=>document.getElementById(id),attempts=new Set();let sequence=0;
 const value=id=>$(id)?.value.trim()||'';
 const checked=id=>!!$(id)?.checked;
 const visible=el=>!el.disabled&&!el.closest('[hidden]')&&!(el.closest('#wi-direct')&&value('wi-mode')==='compose')&&!(el.closest('#wi-compose')&&value('wi-mode')==='direct');
 function rules(button){
  const required=[],checks=[],positive=[];const id=button.id;
  if(['wi-adopt','wi-hold','wi-exclude'].includes(id)){
   required.push('wi-name','wi-unit','wi-quantity','wi-reason');
   if(id==='wi-adopt'){
    required.push('wi-evidence');checks.push('wi-quantity-check','wi-price-check');positive.push('wi-quantity');
    if(value('wi-mode')==='direct')required.push('wi-price');
    else{
     required.push('wi-quote','wi-reduction','wi-material-rate','wi-electrician','wi-electric-coeff','wi-ordinary','wi-ordinary-coeff','wi-labor-rate');
     if(Number(value('wi-electric-coeff'))>0)positive.push('wi-electrician');
     if(Number(value('wi-ordinary-coeff'))>0)positive.push('wi-ordinary');
    }
   }
  }
  if(id==='ws-save'){
   required.push('ws-title','ws-year','ws-labor-source','ws-months','ws-electrician','ws-ordinary','ws-tax');
   if(checked('ws-checked')){required.push('ws-source');positive.push('ws-months');}
   if(value('ws-purpose')==='予算用')required.push('ws-budget');
  }
  if(id==='sc-save'&&checked('sc-checked'))required.push('sc-contract','sc-start','sc-amount');
  if(id==='sd-save'){
   if(['差戻し','対象外'].includes(value('sd-state')))required.push('sd-note');
   if(value('sd-state')==='確認済み'){
    document.querySelectorAll('[data-sd-part],[data-sd-material]').forEach(el=>checks.push(identify(el)));
    document.querySelectorAll('[data-sd-part-kind]').forEach(el=>{
     if(el.value!=='needed')required.push(identify(document.querySelector('[data-sd-part-note="'+el.dataset.sdPartKind+'"]')));
    });
   }
  }
  if(id==='price-register')required.push('pr-name','pr-unit','pr-price','pr-source','pr-conditions');
  if(id==='drawing-parse')required.push('drawing-file-label');
  if(button.hasAttribute('data-pub-apply'))required.push('pub-price-'+button.dataset.pubApply);
  return {required,checks,positive};
 }
 function identify(el){if(!el.id)el.id='feedback-field-'+(++sequence);return el.id;}
 function scope(button){return button.closest('#wb-dialog-body')||button.closest('section')||document.body;}
 function errors(button){
  const {required,checks,positive}=rules(button),bad=new Map();
  if(button.id==='wb-approve'&&window.WB){
   const issues=WB.issues();if(issues.length){const el=$('wb-next');el.tabIndex=-1;bad.set(el,issues.join('／'));}
  }
  if(button.id==='wb-export'&&window.WB&&!WB.adopted().length){const el=$('wb-next');el.tabIndex=-1;bad.set(el,'先に明細を確認して採用してください。');}

  for(const id of required){const el=$(id);if(el&&!el.disabled&&!el.value.trim()&&el.dataset.zeroCleared!=='1')bad.set(el,'入力してください。');}
  for(const id of checks){const el=$(id);if(el&&!el.checked)bad.set(el,'確認してチェックしてください。');}
  for(const id of positive){const el=$(id);if(el&&!(Number(el.value)>0))bad.set(el,'0より大きい数値を入力してください。');}
  scope(button).querySelectorAll('input[type="number"],input[type="date"],select').forEach(el=>{
   if(!visible(el))return;
   if(!el.validity.valid)bad.set(el,el.type==='number'?'数値の入力範囲を確認してください。':'選択・入力内容を確認してください。');
  });
  if(['wi-adopt','wi-hold','wi-exclude'].includes(button.id)&&value('wi-category')!=='控除'&&value('wi-mode')==='direct'&&value('wi-price')&&Number(value('wi-price'))<0)bad.set($('wi-price'),'負の単価は工事区分「控除」を選択してください。');
  return bad;
 }
 function clear(el){
  const id=el.dataset.feedbackId;if(id)$(id)?.remove();
  const described=(el.getAttribute('aria-describedby')||'').split(' ').filter(x=>x&&x!==id);
  if(described.length)el.setAttribute('aria-describedby',described.join(' '));else el.removeAttribute('aria-describedby');
  el.removeAttribute('aria-invalid');delete el.dataset.feedbackId;
  el.closest('label')?.classList.remove('field-error');
 }
 function display(button,focus){
  const root=scope(button);root.querySelectorAll('[data-feedback-id]').forEach(clear);
  root.querySelector('.form-error-summary')?.remove();const bad=errors(button);
  for(const [el,message] of bad){
   const id=identify(el)+'-error';el.dataset.feedbackId=id;el.setAttribute('aria-invalid','true');
   el.setAttribute('aria-describedby',((el.getAttribute('aria-describedby')||'')+' '+id).trim());
   const msg=document.createElement('span');msg.className='field-error-message';msg.id=id;msg.textContent=message;
   const label=el.closest('label');label?.classList.add('field-error');el.insertAdjacentElement('afterend',msg);
  }
  if(bad.size){
   const summary=document.createElement('p');summary.className='form-error-summary';summary.setAttribute('role','alert');
   summary.textContent='入力・確認が必要な箇所が'+bad.size+'件あります。赤い欄を確認してください。';root.prepend(summary);
   if(focus){const first=bad.keys().next().value;for(let node=first.parentElement;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;first.focus();first.scrollIntoView({block:'center',behavior:'smooth'});}
  }
  return bad.size;
 }
 const actions=new Set(['wi-adopt','wi-hold','wi-exclude','ws-save','sc-save','sd-save','price-register','drawing-parse','wb-approve','wb-export']);
 document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||(!actions.has(button.id)&&!button.hasAttribute('data-pub-apply')))return;
  for(const old of attempts)if(!old.isConnected||scope(old)===scope(button))attempts.delete(old);
  attempts.add(button);if(display(button,true)){event.preventDefault();event.stopImmediatePropagation();}
 },true);
 function refresh(){for(const button of attempts){if(!button.isConnected)attempts.delete(button);else display(button,false);}}
 window.addEventListener('wb-render',()=>{
  document.querySelectorAll('[data-feedback-id]').forEach(el=>{if(!el.closest('#wb-dialog-body'))clear(el);});
  document.querySelectorAll('.form-error-summary').forEach(el=>{if(!el.closest('#wb-dialog-body'))el.remove();});
 });
 document.addEventListener('input',refresh);document.addEventListener('change',refresh);
})();
