import {defaults,normalize} from './core.js';
import {sourceDefinitions,sourceOrigin} from './sources.js';
import {applyTranslations,message as t} from './i18n.js';
import {revealTheme} from './vendor/circular-theme-switch/index.js';

const $=id=>document.getElementById(id);
const locale=chrome.i18n.getUILanguage();
let currentCustomSources=[];
let currentSourceSettings={};
let currentSourceMeta={};
let removedBuiltInSources=[];

applyTranslations();

function formattedDate(value){return new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short'}).format(new Date(value))}
function sourceDescription(source){
 const meta=currentSourceMeta[source.id];
 const count=(meta?.count??source.bundledCount??0).toLocaleString(locale);
 if(currentSourceSettings[source.id]?.enabled===false)return t('sourceDisabled',[count]);
 if(meta?.error)return t(meta.error)||meta.error;
 if(meta?.updatedAt)return t('sourceUpdated',[count,formattedDate(meta.updatedAt)]);
 return source.builtIn?t('sourceBundled',[count]):t('sourceNotLoaded');
}
function sourceName(url){
 const parsed=new URL(url);
 const leaf=parsed.pathname.split('/').filter(Boolean).at(-1)?.replace(/\.(txt|list|hosts)$/i,'');
 return (leaf||parsed.hostname).replace(/[-_]+/g,' ').trim().slice(0,60);
}
function updateThemeButton(){
 const light=document.documentElement.dataset.theme==='light';
 $('themeIcon').textContent=light?'☾':'☀';
 const label=t(light?'themeToDark':'themeToLight');
 $('themeToggle').setAttribute('aria-label',label);$('themeToggle').title=label;
}
function activateTab(name,{focus=false}={}){
 const valid=['blocklists','blacklist','whitelist'].includes(name)?name:'blocklists';
 for(const button of document.querySelectorAll('.rule-tab')){const active=button.dataset.tab===valid;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;if(active&&focus)button.focus()}
 for(const panel of document.querySelectorAll('.rule-panel'))panel.hidden=panel.id!==`panel-${valid}`;
 localStorage.setItem('slate-rule-tab',valid);
}
function setStatusIndicator(state){$('statusIndicator').className=`status-indicator ${state}`}
// Panels get a fixed height measured with optional actions visible, so later state changes never resize them. Side by side they share the tallest height.
let panelWidth=0;
function syncPanelHeight(){
 const workspace=document.querySelector('.workspace');const panels=[...workspace.querySelectorAll('.panel')];const width=workspace.clientWidth;
 const previous=panels.map(panel=>width===panelWidth?parseFloat(panel.style.getPropertyValue('--panel-height'))||0:0);
 for(const panel of panels)panel.style.removeProperty('--panel-height');
 // Optional controls are measured visible so showing them later never grows a panel.
 const optional=[$('clean'),$('restoreSources')].map(node=>[node,node.hidden]);for(const [node] of optional)node.hidden=false;workspace.style.alignItems='start';
 let heights=panels.map((panel,index)=>Math.max(previous[index],Math.ceil(panel.getBoundingClientRect().height)));
 const sideBySide=new Set(panels.map(panel=>panel.offsetTop)).size===1;if(sideBySide)heights=heights.map(()=>Math.max(...heights));
 for(const [node,hidden] of optional)node.hidden=hidden;workspace.style.alignItems='';panelWidth=width;
 panels.forEach((panel,index)=>panel.style.setProperty('--panel-height',`${heights[index]}px`));
}
new ResizeObserver(()=>{if(document.querySelector('.workspace').clientWidth!==panelWidth)syncPanelHeight()}).observe(document.querySelector('.workspace'));

updateThemeButton();
$('themeToggle').onclick=event=>revealTheme(()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='light'?'dark':'light';localStorage.setItem('slate-theme',document.documentElement.dataset.theme);updateThemeButton()},{event});
for(const button of document.querySelectorAll('.rule-tab'))button.onclick=()=>activateTab(button.dataset.tab);
activateTab(localStorage.getItem('slate-rule-tab'));

async function removeSource(source){
 const data=await chrome.storage.local.get(['sourceData','sourceMeta','deleteCookies']);
 const sourceData={...(data.sourceData??{})};delete sourceData[source.id];
 const sourceMeta={...(data.sourceMeta??{})};delete sourceMeta[source.id];
 const sourceSettings={...currentSourceSettings};delete sourceSettings[source.id];
 if(source.builtIn){removedBuiltInSources=[...new Set([...removedBuiltInSources,source.id])]}else{currentCustomSources=currentCustomSources.filter(item=>item.id!==source.id)}
 await chrome.storage.local.set({customSources:currentCustomSources,removedBuiltInSources,sourceData,sourceMeta,sourceSettings});
 if(!source.builtIn){const origin=sourceOrigin(source.url);const used=currentCustomSources.some(item=>sourceOrigin(item.url)===origin);if(!data.deleteCookies&&!used)await chrome.permissions.remove({origins:[origin]})}
 $('sourceMessage').textContent=t('sourceRemoved');await status();
}
function renderSources(){
 const container=$('sourceList');container.replaceChildren();
 for(const source of sourceDefinitions(currentCustomSources,removedBuiltInSources)){
  const row=document.createElement('div');row.className='source-row';
  const copy=document.createElement('div');copy.className='source-copy';
  const name=document.createElement('strong');name.textContent=source.name;
  const link=document.createElement('a');link.href=source.url;link.target='_blank';link.rel='noreferrer';link.textContent=source.url.replace(/^https:\/\/raw\.githubusercontent\.com\//,'github.com/');link.title=source.url;
  const description=document.createElement('small');description.textContent=sourceDescription(source);copy.append(name,link,description);
  const controls=document.createElement('div');controls.className='source-controls';
  const remove=document.createElement('button');remove.type='button';remove.className='remove-source';remove.textContent=t('remove');remove.setAttribute('aria-label',`${t('remove')}: ${source.name}`);remove.onclick=async()=>{remove.disabled=true;try{await removeSource(source)}catch{$('sourceMessage').textContent=t('sourceRemoveFailed')}finally{remove.disabled=false}};
  const label=document.createElement('label');label.className='source-toggle';
  const toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=currentSourceSettings[source.id]?.enabled!==false;toggle.setAttribute('aria-label',t('enableSource',[source.name]));
  toggle.onchange=async()=>{toggle.disabled=true;currentSourceSettings={...currentSourceSettings,[source.id]:{enabled:toggle.checked}};try{await chrome.storage.local.set({sourceSettings:currentSourceSettings});$('sourceMessage').textContent=t(toggle.checked?'sourceActivated':'sourceDeactivated',[source.name]);if(toggle.checked&&!currentSourceMeta[source.id]?.updatedAt)await chrome.runtime.sendMessage({type:'refresh'});await status()}catch{toggle.checked=!toggle.checked;$('sourceMessage').textContent=t('changeFailed')}finally{toggle.disabled=false}};
  label.append(toggle);controls.append(remove,label);row.append(copy,controls);container.append(row);
 }
 $('restoreSources').hidden=removedBuiltInSources.length===0;
}
async function status(){
 const data=await chrome.storage.local.get(['status','sourceMeta','customSources','sourceSettings','removedBuiltInSources']);const value=data.status;
 if(value?.error){$('status').textContent=value.error;setStatusIndicator('is-checking')}
 else if(value){$('status').textContent=t('statusDomains',[String(value.domains??0),String(value.failed??0),formattedDate(value.checkedAt)]);setStatusIndicator(value.failed?'is-checking':value.domains>0?'has-findings':'is-clean')}
 else{$('status').textContent=t('statusNotChecked');setStatusIndicator('is-checking')}
 $('clean').hidden=!!value?.error||!(value?.domains>0);currentCustomSources=data.customSources??[];currentSourceSettings=data.sourceSettings??{};currentSourceMeta=data.sourceMeta??{};removedBuiltInSources=data.removedBuiltInSources??[];renderSources();syncPanelHeight();
}

const data=await chrome.storage.local.get(['blacklist','whitelist','domains','deleteCookies','scanIntervalMinutes','customSources','removedBuiltInSources']);
currentCustomSources=data.customSources??[];removedBuiltInSources=data.removedBuiltInSources??[];
$('scanInterval').value=String(data.scanIntervalMinutes??0);
$('scanInterval').onchange=async()=>{try{await chrome.storage.local.set({scanIntervalMinutes:Number($('scanInterval').value)});$('intervalMessage').textContent=t('intervalSaved')}catch{$('intervalMessage').textContent=t('saveFailed')}};
$('deleteCookies').checked=data.deleteCookies===true&&await chrome.permissions.contains({permissions:['cookies'],origins:['http://*/*','https://*/*']});
$('deleteCookies').onchange=async()=>{const checkbox=$('deleteCookies');try{if(checkbox.checked){const granted=await chrome.permissions.request({permissions:['cookies'],origins:['http://*/*','https://*/*']});if(!granted){checkbox.checked=false;$('cookieMessage').textContent=t('websiteAccessDenied');return}}else{await chrome.permissions.remove({permissions:['cookies'],origins:['http://*/*','https://*/*']});const origins=[...new Set(currentCustomSources.map(source=>sourceOrigin(source.url)))];if(origins.length&&!await chrome.permissions.contains({origins}))await chrome.permissions.request({origins})}await chrome.storage.local.set({deleteCookies:checkbox.checked});$('cookieMessage').textContent=t(checkbox.checked?'cookieEnabled':'cookieDisabled')}catch{checkbox.checked=!checkbox.checked;$('cookieMessage').textContent=t('changeFailed')}};
$('blacklist').value=(data.blacklist??data.domains??defaults).join('\n');$('whitelist').value=(data.whitelist??[]).join('\n');
for(const [key,button,message] of [['blacklist','saveBlacklist','blacklistMessage'],['whitelist','saveWhitelist','whitelistMessage']])$(button).onclick=async()=>{try{const list=[...new Set($(key).value.split(/\n/).map(normalize).filter(Boolean))];await chrome.storage.local.set({[key]:list});$(message).textContent=t('domainsSaved',[String(list.length)])}catch(error){$(message).textContent=error.message}};
$('addSourceForm').onsubmit=async event=>{event.preventDefault();const addButton=$('addSource');try{const url=new URL($('sourceUrl').value.trim());const origin=sourceOrigin(url.href);if(sourceDefinitions(currentCustomSources,removedBuiltInSources).some(source=>source.url===url.href))throw Error(t('urlAlreadyAdded'));const granted=await chrome.permissions.request({origins:[origin]});if(!granted)throw Error(t('listAccessDenied'));addButton.disabled=true;const source={id:`custom-${crypto.randomUUID()}`,name:sourceName(url.href),url:url.href};currentCustomSources=[...currentCustomSources,source];currentSourceSettings={...currentSourceSettings,[source.id]:{enabled:true}};await chrome.storage.local.set({customSources:currentCustomSources,sourceSettings:currentSourceSettings});$('sourceMessage').textContent=t('listLoading');const result=await chrome.runtime.sendMessage({type:'refresh'});if(!result?.ok)throw Error(t('listLoadFailed'));$('addSourceForm').reset();$('sourceMessage').textContent=t('listAdded');await status()}catch(error){$('sourceMessage').textContent=error.message||t('listAddFailed')}finally{addButton.disabled=false}};
$('restoreSources').onclick=async()=>{removedBuiltInSources=[];await chrome.storage.local.set({removedBuiltInSources});$('sourceMessage').textContent=t('defaultsRestored');await chrome.runtime.sendMessage({type:'refresh'});await status()};
$('scan').onclick=async()=>{$('scan').disabled=true;setStatusIndicator('is-checking');try{$('status').textContent=t('scanRunning');await chrome.runtime.sendMessage({type:'scan'});await status()}finally{$('scan').disabled=false}};
$('clean').onclick=async()=>{$('clean').disabled=true;$('clean').hidden=true;setStatusIndicator('is-checking');$('status').textContent=t('cleanupRunning');try{const result=await chrome.runtime.sendMessage({type:'clean'});if(!result?.ok)throw Error();await status()}catch{$('status').textContent=t('cleanupFailed');$('clean').hidden=false}finally{$('clean').disabled=false}};
$('refresh').onclick=async()=>{$('refresh').disabled=true;$('refreshMessage').textContent=t('updateRunning');try{const result=await chrome.runtime.sendMessage({type:'refresh'});await status();$('refreshMessage').textContent=t(result?.ok?'updateSuccess':'updateFailed')}catch{$('refreshMessage').textContent=t('updateFailed')}finally{$('refresh').disabled=false}};
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes.status||changes.sourceMeta||changes.sourceSettings||changes.customSources||changes.removedBuiltInSources))void status()});
await status();
