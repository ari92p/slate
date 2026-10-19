import {defaults,normalize} from './core.js';
import {sourceDefinitions,sourceOrigin} from './sources.js';

const $=id=>document.getElementById(id);
let currentCustomSources=[];
let currentSourceSettings={};
let currentSourceMeta={};

function sourceDescription(source) {
 const meta=currentSourceMeta[source.id];
 const count=(meta?.count??source.bundledCount??0).toLocaleString('de-DE');
 if(currentSourceSettings[source.id]?.enabled===false)return `Deaktiviert · ${count} Einträge gespeichert`;
 if(meta?.error)return meta.error;
 if(meta?.updatedAt)return `${count} Einträge · aktualisiert ${new Date(meta.updatedAt).toLocaleString('de-DE')}`;
 return source.builtIn?`${count} Einträge · mitgelieferter Stand`:'Noch nicht geladen';
}

async function removeCustomSource(source) {
 const remaining=currentCustomSources.filter(item=>item.id!==source.id);
 const data=await chrome.storage.local.get(['sourceData','sourceMeta','deleteCookies']);
 const sourceData={...(data.sourceData??{})};delete sourceData[source.id];
 const sourceMeta={...(data.sourceMeta??{})};delete sourceMeta[source.id];
 const sourceSettings={...currentSourceSettings};delete sourceSettings[source.id];
 await chrome.storage.local.set({customSources:remaining,sourceData,sourceMeta,sourceSettings});
 const origin=sourceOrigin(source.url);
 const originStillUsed=remaining.some(item=>sourceOrigin(item.url)===origin);
 if(!data.deleteCookies&&!originStillUsed)await chrome.permissions.remove({origins:[origin]});
 $('sourceMessage').textContent='Filterliste entfernt.';
 await status();
}

function renderSources() {
 const container=$('sourceList');container.replaceChildren();
 for(const source of sourceDefinitions(currentCustomSources)) {
  const row=document.createElement('div');row.className='source-row';
  const copy=document.createElement('div');copy.className='source-copy';
  const name=document.createElement('strong');name.textContent=source.name;
  const description=document.createElement('small');description.textContent=sourceDescription(source);
  copy.append(name,description);

  const controls=document.createElement('div');controls.className='source-controls';
  if(!source.builtIn) {
   const remove=document.createElement('button');remove.type='button';remove.className='remove-source';remove.textContent='Entfernen';
   remove.setAttribute('aria-label',`${source.name} entfernen`);
   remove.onclick=async()=>{remove.disabled=true;try{await removeCustomSource(source)}catch{$('sourceMessage').textContent='Filterliste konnte nicht entfernt werden.'}finally{remove.disabled=false}};
   controls.append(remove);
  }
  const label=document.createElement('label');label.className='source-toggle';
  const toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=currentSourceSettings[source.id]?.enabled!==false;
  toggle.setAttribute('aria-label',`${source.name} aktivieren`);
  toggle.onchange=async()=>{
   toggle.disabled=true;
   currentSourceSettings={...currentSourceSettings,[source.id]:{enabled:toggle.checked}};
   try {
    await chrome.storage.local.set({sourceSettings:currentSourceSettings});
    $('sourceMessage').textContent=toggle.checked?`${source.name} aktiviert.`:`${source.name} deaktiviert.`;
    if(toggle.checked&&!currentSourceMeta[source.id]?.updatedAt)await chrome.runtime.sendMessage({type:'refresh'});
    await status();
   } catch {
    toggle.checked=!toggle.checked;$('sourceMessage').textContent='Änderung fehlgeschlagen.';
   } finally {
    toggle.disabled=false;
   }
  };
  label.append(toggle);controls.append(label);row.append(copy,controls);container.append(row);
 }
}

async function status(){
 const data=await chrome.storage.local.get(['status','sourceMeta','customSources','sourceSettings']);
 const s=data.status;
 $('status').textContent=s?.error||(s?`${s.domains??0} Domains · ${s.failed||0} Löschfehler · ${new Date(s.checkedAt).toLocaleString('de-DE')}`:'Noch keine Prüfung');
 $('clean').hidden=!!s?.error||!(s?.domains>0);
 currentCustomSources=data.customSources??[];
 currentSourceSettings=data.sourceSettings??{};
 currentSourceMeta=data.sourceMeta??{};
 renderSources();
}

const data=await chrome.storage.local.get(['blacklist','whitelist','domains','deleteCookies','scanIntervalMinutes','customSources']);
currentCustomSources=data.customSources??[];
$('scanInterval').value=String(data.scanIntervalMinutes??0);
$('scanInterval').onchange=async()=>{
 try {
  await chrome.storage.local.set({scanIntervalMinutes:Number($('scanInterval').value)});
  $('intervalMessage').textContent='Prüfrhythmus gespeichert.';
 } catch {
  $('intervalMessage').textContent='Speichern fehlgeschlagen.';
 }
};

$('deleteCookies').checked=data.deleteCookies===true&&await chrome.permissions.contains({permissions:['cookies'],origins:['http://*/*','https://*/*']});
$('deleteCookies').onchange=async()=>{
 const checkbox=$('deleteCookies');
 try {
  if(checkbox.checked) {
   const granted=await chrome.permissions.request({permissions:['cookies'],origins:['http://*/*','https://*/*']});
   if(!granted){checkbox.checked=false;$('cookieMessage').textContent='Websitezugriff wurde nicht erteilt.';return}
  } else {
   await chrome.permissions.remove({permissions:['cookies'],origins:['http://*/*','https://*/*']});
   const origins=[...new Set(currentCustomSources.map(source=>sourceOrigin(source.url)))];
   if(origins.length&&!await chrome.permissions.contains({origins}))await chrome.permissions.request({origins});
  }
  await chrome.storage.local.set({deleteCookies:checkbox.checked});
  $('cookieMessage').textContent=checkbox.checked?'Cookie-Bereinigung aktiviert.':'Cookie-Bereinigung ausgeschaltet.';
 } catch {
  checkbox.checked=!checkbox.checked;
  $('cookieMessage').textContent='Änderung fehlgeschlagen.';
 }
};

$('blacklist').value=(data.blacklist??data.domains??defaults).join('\n');
$('whitelist').value=(data.whitelist??[]).join('\n');
for(const [key,button,message] of [['blacklist','saveBlacklist','blacklistMessage'],['whitelist','saveWhitelist','whitelistMessage']]) {
 $(button).onclick=async()=>{try{const list=[...new Set($(key).value.split(/\n/).map(normalize).filter(Boolean))];await chrome.storage.local.set({[key]:list});$(message).textContent=`${list.length} Domains gespeichert.`;}catch(e){$(message).textContent=e.message}};
}

$('addSourceForm').onsubmit=async event=>{
 event.preventDefault();
 const name=$('sourceName').value.trim();
 const addButton=$('addSource');
 try {
  if(name.length<2)throw Error('Bitte einen Namen mit mindestens zwei Zeichen eingeben.');
  const url=new URL($('sourceUrl').value.trim());
  const origin=sourceOrigin(url.href);
  if(sourceDefinitions(currentCustomSources).some(source=>source.url===url.href))throw Error('Diese Filterliste ist bereits vorhanden.');
  const granted=await chrome.permissions.request({origins:[origin]});
  if(!granted)throw Error('Zugriff auf die Listenadresse wurde nicht erteilt.');
  addButton.disabled=true;
  const source={id:`custom-${crypto.randomUUID()}`,name,url:url.href};
  currentCustomSources=[...currentCustomSources,source];
  currentSourceSettings={...currentSourceSettings,[source.id]:{enabled:true}};
  await chrome.storage.local.set({customSources:currentCustomSources,sourceSettings:currentSourceSettings});
  $('sourceMessage').textContent='Filterliste wird geladen …';
  const result=await chrome.runtime.sendMessage({type:'refresh'});
  if(!result?.ok)throw Error('Filterliste konnte nicht geladen werden.');
  $('addSourceForm').reset();$('sourceMessage').textContent='Filterliste hinzugefügt.';await status();
 } catch(error) {
  $('sourceMessage').textContent=error.message||'Filterliste konnte nicht hinzugefügt werden.';
 } finally {
  addButton.disabled=false;
 }
};

$('scan').onclick=async()=>{$('scan').disabled=true;try{$('status').textContent='Prüfung läuft …';await chrome.runtime.sendMessage({type:'scan'});await status()}finally{$('scan').disabled=false}};
$('clean').onclick=async()=>{
 $('clean').disabled=true;$('clean').hidden=true;$('status').textContent='Bereinigung läuft …';
 try {
  const result=await chrome.runtime.sendMessage({type:'clean'});
  if(!result?.ok)throw Error('cleanup failed');
  await status();
 } catch {
  $('status').textContent='Bereinigung fehlgeschlagen.';$('clean').hidden=false;
 } finally {
  $('clean').disabled=false;
 }
};
$('refresh').onclick=async()=>{$('refresh').disabled=true;$('refreshMessage').textContent='Aktualisierung läuft …';try{const result=await chrome.runtime.sendMessage({type:'refresh'});await status();$('refreshMessage').textContent=result?.ok?'Alle aktiven Blocklisten wurden aktualisiert.':'Aktualisierung fehlgeschlagen.'}catch{$('refreshMessage').textContent='Aktualisierung fehlgeschlagen.'}finally{$('refresh').disabled=false}};
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes.status||changes.sourceMeta||changes.sourceSettings||changes.customSources))void status()});
await status();
