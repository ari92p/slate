import {normalize} from './core.js';
import {sourceDefinitions,sourceOrigin} from './sources.js';
import {applyTranslations,message as t,textLocale} from './i18n.js';
import {revealTheme} from './vendor/circular-theme-switch/index.js';

const $=id=>document.getElementById(id);
const locale=textLocale;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let currentCustomSources=[];
let currentSourceSettings={};
let currentSourceMeta={};
let removedBuiltInSources=[];
let busy=false;

applyTranslations();

function formattedDate(value){return new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}
function formattedCount(value){return Number(value??0).toLocaleString(locale)}

// Theme
const moon='M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z';
const sun='M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4';
function updateThemeButton(){
 const light=document.documentElement.dataset.theme==='light';
 $('themeGlyph').setAttribute('d',light?moon:sun);
 const label=t(light?'themeToDark':'themeToLight');
 $('themeToggle').setAttribute('aria-label',label);$('themeToggle').title=label;
}
updateThemeButton();
$('themeToggle').onclick=event=>revealTheme(()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='light'?'dark':'light';localStorage.setItem('slate-theme',document.documentElement.dataset.theme);updateThemeButton()},{event});

// Slate
function slateFor(value){
 if(!value)return {title:t('slateNotCheckedTitle'),text:t('slateNotCheckedText'),action:'scanNow'};
 if(value.error)return {title:t('slateScanErrorTitle'),text:t('slateScanErrorText'),error:true};
 const date=formattedDate(value.checkedAt);
 const findings=value.domains===1?t('slateFindingsOne'):t('slateFindingsMany',[formattedCount(value.domains)]);
 if(value.failed>0)return {title:value.domains>0?findings:t('slateCleanedTitle'),text:t('slateDeleteErrorText'),error:true,action:'cleanAgain'};
 if(value.domains>0)return {title:findings,text:t('slateFindingsText',[date]),action:'cleanHistory'};
 if(value.lastClean?.history||value.lastClean?.cookies)return {title:t('slateCleanedTitle'),text:t('slateCleanedText',[formattedCount(value.lastClean.history),date]),tick:true};
 return {title:t('slateCleanTitle'),text:t('slateCleanText',[date]),tick:true};
}
const working={
 checking:{title:t('slateCheckingTitle'),text:t('slateCheckingText')},
 cleaning:{title:t('slateCleaningTitle'),text:t('slateCleaningText')},
};
function buildState(state,{sizer=false}={}){
 const element=document.createElement('div');element.className=sizer?'state sizer':'state';
 if(sizer){element.setAttribute('aria-hidden','true');element.inert=true}
 if(state.tick)element.insertAdjacentHTML('beforeend','<svg class="tick" viewBox="0 0 44 44" aria-hidden="true"><path d="M8.5 23.5c3 2.4 6 5.6 8.6 9.3C22 23 28.7 14.6 36 9.2"/></svg>');
 const title=document.createElement('h1');title.textContent=state.title;
 const text=document.createElement('p');text.textContent=state.text;if(state.error)text.className='error';
 element.append(title,text);
 if(state.action){
  const button=document.createElement('button');button.type='button';button.className='chalk-button';button.textContent=t(state.action);
  button.onclick=state.action==='scanNow'?scan:clean;button.disabled=busy;
  element.append(button);
 }
 return element;
}
// The longest variant of every state sits invisibly in the same grid cell, so the slate never changes height.
function renderSizers(){
 const now=Date.now();
 const variants=[slateFor(undefined),slateFor({error:'scan'}),slateFor({domains:99999,failed:1,checkedAt:now}),slateFor({domains:99999,failed:0,checkedAt:now}),slateFor({domains:0,checkedAt:now,lastClean:{history:99999}}),slateFor({domains:0,checkedAt:now}),working.checking,working.cleaning];
 $('slateStage').replaceChildren(...variants.map(state=>buildState(state,{sizer:true})));
}
let shownKey='';
function showSlate(state,{wipe=false}={}){
 const key=JSON.stringify(state);
 if(key===shownKey&&!wipe)return Promise.resolve();
 shownKey=key;
 const stage=$('slateStage');const next=buildState(state);
 const current=[...stage.querySelectorAll('.state:not(.sizer)')];
 // Hidden tabs pause animations, so they switch without wiping.
 if(!wipe||reducedMotion.matches||document.hidden||!current.length){for(const element of current)element.remove();$('slateWet').className='wet';stage.append(next);return Promise.resolve()}
 const wet=$('slateWet');
 for(const element of current.slice(0,-1))element.remove();
 const old=current.at(-1);
 return new Promise(resolve=>{
  old.classList.add('leaving');next.classList.add('arriving');stage.append(next);wet.className='wet on';
  const erased=()=>{if(!old.isConnected)return;old.remove();wet.className='wet on drying'};
  let done=false;
  const written=()=>{if(done)return;done=true;erased();next.classList.remove('arriving');setTimeout(()=>{if(wet.classList.contains('drying'))wet.className='wet'},1800);resolve()};
  old.addEventListener('animationend',erased,{once:true});
  next.addEventListener('animationend',written,{once:true});
  // Fallback if the tab is hidden mid-wipe and the animations never finish.
  setTimeout(written,1600);
 });
}
function setBusy(value){busy=value;$('scan').disabled=value;for(const button of $('slateStage').querySelectorAll('.state:not(.sizer) .chalk-button'))button.disabled=value}

// Lists
function sourceDescription(source){
 const meta=currentSourceMeta[source.id];
 const count=formattedCount(meta?.count??source.bundledCount??0);
 if(currentSourceSettings[source.id]?.enabled===false)return {text:t('sourceOff',[count])};
 if(meta?.error)return {text:t(meta.error)||meta.error,error:true};
 if(meta?.updatedAt)return {text:t('sourceDomains',[count,formattedDate(meta.updatedAt)])};
 return {text:source.builtIn?t('sourceDomainsBundled',[count]):t('sourceNotLoaded')};
}
function sourceName(url){
 const parsed=new URL(url);
 const leaf=parsed.pathname.split('/').filter(Boolean).at(-1)?.replace(/\.(txt|list|hosts)$/i,'');
 return (leaf||parsed.hostname).replace(/[-_]+/g,' ').trim().slice(0,60);
}
function sourceLabel(url){
 const parsed=new URL(url);
 if(parsed.hostname==='raw.githubusercontent.com'){const [owner,repo]=parsed.pathname.split('/').filter(Boolean);return `github.com/${owner}/${repo}`}
 return parsed.hostname+parsed.pathname;
}
async function removeSource(source){
 const data=await chrome.storage.local.get(['sourceData','sourceMeta','deleteCookies']);
 const sourceData={...(data.sourceData??{})};delete sourceData[source.id];
 const sourceMeta={...(data.sourceMeta??{})};delete sourceMeta[source.id];
 const sourceSettings={...currentSourceSettings};delete sourceSettings[source.id];
 if(source.builtIn){removedBuiltInSources=[...new Set([...removedBuiltInSources,source.id])]}else{currentCustomSources=currentCustomSources.filter(item=>item.id!==source.id)}
 await chrome.storage.local.set({customSources:currentCustomSources,removedBuiltInSources,sourceData,sourceMeta,sourceSettings});
 if(!source.builtIn){const origin=sourceOrigin(source.url);const used=currentCustomSources.some(item=>sourceOrigin(item.url)===origin);if(!data.deleteCookies&&!used)await chrome.permissions.remove({origins:[origin]})}
 $('listMessage').textContent=t('sourceRemoved');await status();
}
function renderSources(){
 const sources=sourceDefinitions(currentCustomSources,removedBuiltInSources);
 const rows=sources.map(source=>{
  const row=document.createElement('li');row.className='row';
  const copy=document.createElement('div');copy.className='row-copy';
  const name=document.createElement('span');name.className='row-title';name.textContent=source.name;
  const description=sourceDescription(source);
  const meta=document.createElement('span');meta.className=description.error?'row-meta error':'row-meta';meta.textContent=description.text;
  const link=document.createElement('a');link.className='row-link';link.href=source.url;link.target='_blank';link.rel='noreferrer';link.textContent=sourceLabel(source.url);link.title=source.url;
  copy.append(name,meta,link);
  const actions=document.createElement('div');actions.className='row-actions';
  const remove=document.createElement('button');remove.type='button';remove.className='text-button';remove.textContent=t('remove');remove.setAttribute('aria-label',`${t('remove')}: ${source.name}`);
  remove.onclick=async()=>{remove.disabled=true;try{await removeSource(source)}catch{$('listMessage').textContent=t('sourceRemoveFailed')}finally{remove.disabled=false}};
  const toggle=document.createElement('input');toggle.type='checkbox';toggle.className='switch';toggle.checked=currentSourceSettings[source.id]?.enabled!==false;toggle.setAttribute('aria-label',t('enableSource',[source.name]));
  toggle.onchange=async()=>{toggle.disabled=true;currentSourceSettings={...currentSourceSettings,[source.id]:{enabled:toggle.checked}};try{await chrome.storage.local.set({sourceSettings:currentSourceSettings});$('listMessage').textContent=t(toggle.checked?'sourceActivated':'sourceDeactivated',[source.name]);if(toggle.checked&&!currentSourceMeta[source.id]?.updatedAt)await chrome.runtime.sendMessage({type:'refresh'});await status()}catch{toggle.checked=!toggle.checked;$('listMessage').textContent=t('changeFailed')}finally{toggle.disabled=false}};
  actions.append(remove,toggle);row.append(copy,actions);
  return row;
 });
 $('sourceList').replaceChildren(...rows);
 const failing=sources.some(source=>currentSourceSettings[source.id]?.enabled!==false&&currentSourceMeta[source.id]?.error);
 $('sourceState').textContent=t(failing?'listsHaveErrors':'allListsCurrent');
 $('restoreSources').hidden=removedBuiltInSources.length===0;
}

async function status(){
 const data=await chrome.storage.local.get(['status','sourceMeta','customSources','sourceSettings','removedBuiltInSources']);
 currentCustomSources=data.customSources??[];currentSourceSettings=data.sourceSettings??{};currentSourceMeta=data.sourceMeta??{};removedBuiltInSources=data.removedBuiltInSources??[];
 renderSources();
 if(!busy)await showSlate(slateFor(data.status));
}
async function scan(){
 if(busy)return;setBusy(true);
 try{await showSlate(working.checking);await chrome.runtime.sendMessage({type:'scan'})}
 finally{setBusy(false);await status()}
}
async function clean(){
 if(busy)return;setBusy(true);
 let failed=false;
 try{
  const [result]=await Promise.all([chrome.runtime.sendMessage({type:'clean'}),showSlate(working.cleaning,{wipe:true})]);
  if(!result?.ok)failed=true;
 }catch{failed=true}
 setBusy(false);
 if(failed)await showSlate({title:t('slateScanErrorTitle'),text:t('cleanupFailed'),error:true,action:'cleanAgain'});
 else await status();
 $('slateStage').querySelector('.state:not(.sizer) .chalk-button')?.focus();
}

renderSizers();
const data=await chrome.storage.local.get(['blacklist','whitelist','domains','deleteCookies','scanIntervalMinutes','customSources','removedBuiltInSources']);
currentCustomSources=data.customSources??[];removedBuiltInSources=data.removedBuiltInSources??[];

// Automatic
$('scanInterval').value=String(data.scanIntervalMinutes??0);
$('scanInterval').onchange=async()=>{try{await chrome.storage.local.set({scanIntervalMinutes:Number($('scanInterval').value)});$('autoMessage').textContent=t('intervalSaved')}catch{$('autoMessage').textContent=t('saveFailed')}};
$('deleteCookies').checked=data.deleteCookies===true&&await chrome.permissions.contains({permissions:['cookies'],origins:['http://*/*','https://*/*']});
$('deleteCookies').onchange=async()=>{const checkbox=$('deleteCookies');try{if(checkbox.checked){const granted=await chrome.permissions.request({permissions:['cookies'],origins:['http://*/*','https://*/*']});if(!granted){checkbox.checked=false;$('autoMessage').textContent=t('websiteAccessDenied');return}}else{await chrome.permissions.remove({permissions:['cookies'],origins:['http://*/*','https://*/*']});const origins=[...new Set(currentCustomSources.map(source=>sourceOrigin(source.url)))];if(origins.length&&!await chrome.permissions.contains({origins}))await chrome.permissions.request({origins})}await chrome.storage.local.set({deleteCookies:checkbox.checked});$('autoMessage').textContent=t(checkbox.checked?'cookieEnabled':'cookieDisabled')}catch{checkbox.checked=!checkbox.checked;$('autoMessage').textContent=t('changeFailed')}};

// Own rules
$('blacklist').value=(data.blacklist??[]).join('\n');$('whitelist').value=(data.whitelist??[]).join('\n');
function parseRules(text){
 const list=[];
 for(const line of text.split(/\n/)){
  let domain;
  try{domain=normalize(line)}catch{throw Error(t('invalidDomain',[line.trim()]))}
  if(domain)list.push(domain);
 }
 return [...new Set(list)];
}
$('saveRules').onclick=async()=>{
 try{
  const blacklist=parseRules($('blacklist').value),whitelist=parseRules($('whitelist').value);
  await chrome.storage.local.set({blacklist,whitelist});
  $('blacklist').value=blacklist.join('\n');$('whitelist').value=whitelist.join('\n');
  $('rulesMessage').textContent=t('rulesSaved');
 }catch(error){$('rulesMessage').textContent=error.message||t('saveFailed')}
};

// Adding, updating and restoring lists
$('addSourceForm').onsubmit=async event=>{event.preventDefault();const addButton=$('addSource');try{const url=new URL($('sourceUrl').value.trim());const origin=sourceOrigin(url.href);if(sourceDefinitions(currentCustomSources,removedBuiltInSources).some(source=>source.url===url.href))throw Error(t('urlAlreadyAdded'));const granted=await chrome.permissions.request({origins:[origin]});if(!granted)throw Error(t('listAccessDenied'));addButton.disabled=true;const source={id:`custom-${crypto.randomUUID()}`,name:sourceName(url.href),url:url.href};currentCustomSources=[...currentCustomSources,source];currentSourceSettings={...currentSourceSettings,[source.id]:{enabled:true}};await chrome.storage.local.set({customSources:currentCustomSources,sourceSettings:currentSourceSettings});$('listMessage').textContent=t('listLoading');const result=await chrome.runtime.sendMessage({type:'refresh'});if(!result?.ok)throw Error(t('listLoadFailed'));$('addSourceForm').reset();$('listMessage').textContent=t('listAdded');await status()}catch(error){$('listMessage').textContent=error.message||t('listAddFailed')}finally{addButton.disabled=false}};
$('restoreSources').onclick=async()=>{removedBuiltInSources=[];await chrome.storage.local.set({removedBuiltInSources});$('listMessage').textContent=t('defaultsRestored');await chrome.runtime.sendMessage({type:'refresh'});await status()};
$('refresh').onclick=async()=>{$('refresh').disabled=true;$('listMessage').textContent=t('updateRunning');try{const result=await chrome.runtime.sendMessage({type:'refresh'});await status();$('listMessage').textContent=t(result?.ok?'updateSuccess':'updateFailed')}catch{$('listMessage').textContent=t('updateFailed')}finally{$('refresh').disabled=false}};

$('scan').onclick=scan;
// Scans and cleanups started elsewhere (toolbar icon, schedule) appear exactly like the page's own buttons.
let external=null,externalType=null;
async function mirrorActivity(activity){
 if(activity){
  if(busy&&!external)return; // the page's own button is already showing it
  if(activity.type===externalType)return;
  if(!external)setBusy(true);
  externalType=activity.type;
  // A check can turn into a cleanup; wipe only then, after the previous state is shown.
  const previous=external;
  external=(async()=>{await previous;await showSlate(activity.type==='clean'?working.cleaning:working.checking,{wipe:activity.type==='clean'})})();
 }else if(external){
  externalType=null;
  // Let the wipe finish even when the cleanup was faster than the animation.
  const shown=external;external=null;await shown;
  setBusy(false);await status();
 }
}
chrome.storage.onChanged.addListener((changes,area)=>{
 if(area==='session'&&changes.activity)mirrorActivity(changes.activity.newValue);
 if(area==='local'&&(changes.status||changes.sourceMeta||changes.sourceSettings||changes.customSources||changes.removedBuiltInSources))void status();
});
await status();
mirrorActivity((await chrome.storage.session.get('activity')).activity);
