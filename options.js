import {defaults,normalize} from './core.js';
import {sources} from './sources.js';
const $=id=>document.getElementById(id);
async function status(){
 const {status:s,sourceMeta={}}=await chrome.storage.local.get(['status','sourceMeta']);
 $('status').textContent=s?.error||(s?`${s.domains??0} Domains · ${s.failed||0} Löschfehler · ${new Date(s.checkedAt).toLocaleString('de-DE')}`:'Noch keine Prüfung');
 $('clean').hidden=!!s?.error||!(s?.domains>0);
 $('sourcesStatus').textContent=sources.map(src=>{const v=sourceMeta[src.id];return `${src.name}: ${(v?.count??src.bundledCount).toLocaleString('de-DE')} Einträge · ${v?.updatedAt?'aktualisiert '+new Date(v.updatedAt).toLocaleString('de-DE'):'mitgelieferter Stand 18.10.2026'}${v?.error?' · '+v.error:''}`}).join(' / ');
}
const data=await chrome.storage.local.get(['blacklist','whitelist','domains','deleteCookies','scanIntervalMinutes']);
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
$('refresh').onclick=async()=>{$('refresh').disabled=true;$('refreshMessage').textContent='Aktualisierung läuft …';try{const result=await chrome.runtime.sendMessage({type:'refresh'});await status();$('refreshMessage').textContent=result?.ok?'Aktualisierung abgeschlossen. Quellenstatus siehe oben.':'Aktualisierung fehlgeschlagen.'}catch{$('refreshMessage').textContent='Aktualisierung fehlgeschlagen.'}finally{$('refresh').disabled=false}};
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes.status||changes.sourceMeta))void status()});await status();
