import {migrateBlacklist,inspect,erase,countDomains} from './core.js';
import {sources,sourceDefinitions,parseList,refreshSources,mergeBuiltInDuplicates} from './sources.js';
import {message as t} from './i18n.js';
const DEFAULT_SCAN_INTERVAL_MINUTES=0;
let queue=Promise.resolve(), queuedScan, sourceCache, compiledRules;

async function bundledSources() {
 if(!sourceCache) {
  sourceCache={};
  for(const src of sources) sourceCache[src.id]=parseList(await (await fetch(chrome.runtime.getURL('data/'+src.id+'.txt'))).text());
 }
 return sourceCache;
}

async function rules() {
 if(compiledRules)return compiledRules;
 const data=await chrome.storage.local.get(['blacklist','whitelist','domains','sourceData','deleteCookies','customSources','sourceSettings','removedBuiltInSources']);
 const bundled=await bundledSources();
 const blocked=new Set(data.blacklist??[]);
 for(const src of sourceDefinitions(data.customSources,data.removedBuiltInSources)) {
  if(data.sourceSettings?.[src.id]?.enabled===false)continue;
  for(const d of data.sourceData?.[src.id]?.domains??bundled[src.id]??[])blocked.add(d);
 }
 const cookiePermission=data.deleteCookies===true&&await chrome.permissions.contains({permissions:['cookies'],origins:['http://*/*','https://*/*']});
 compiledRules={blocked,whitelist:data.whitelist??[],deleteCookies:cookiePermission};
 return compiledRules;
}

function invalidateRules(){compiledRules=undefined}

let updating;
function refresh() {
 if(!updating)updating=Promise.all([bundledSources(),chrome.storage.local.get(['customSources','sourceSettings','removedBuiltInSources'])])
  .then(([bundled,data])=>refreshSources(chrome,fetch,bundled,sourceDefinitions(data.customSources,data.removedBuiltInSources),data.sourceSettings??{}))
  .then(()=>{invalidateRules();return schedule()})
  .finally(()=>{updating=null});
 return updating;
}

async function configureScanAlarm() {
 const {scanIntervalMinutes=DEFAULT_SCAN_INTERVAL_MINUTES}=await chrome.storage.local.get('scanIntervalMinutes');
 await chrome.alarms.clear('scan');
 if(scanIntervalMinutes>0)await chrome.alarms.create('scan',{periodInMinutes:scanIntervalMinutes});
}

async function setup() {
 await configureScanAlarm();
 await chrome.alarms.create('sources',{periodInMinutes:1440});
 const blacklist=migrateBlacklist(await chrome.storage.local.get(['blacklist','domains','blacklistDefaultsRemoved']));
 if(blacklist)await chrome.storage.local.set({blacklist,blacklistDefaultsRemoved:true});
 const stored=await chrome.storage.local.get(['customSources','removedBuiltInSources','sourceSettings','sourceData','sourceMeta']);
 const merged=mergeBuiltInDuplicates(stored);
 if(merged) {
  const sourceData={...(stored.sourceData??{})},sourceMeta={...(stored.sourceMeta??{})};
  for(const id of merged.mergedIds){delete sourceData[id];delete sourceMeta[id]}
  await chrome.storage.local.set({customSources:merged.customSources,removedBuiltInSources:merged.removedBuiltInSources,sourceSettings:merged.sourceSettings,sourceData,sourceMeta});
 }
 await schedule();
 const {sourceMeta={},customSources=[],sourceSettings={},removedBuiltInSources=[]}=await chrome.storage.local.get(['sourceMeta','customSources','sourceSettings','removedBuiltInSources']);
 if(sourceDefinitions(customSources,removedBuiltInSources).some(s=>sourceSettings[s.id]?.enabled!==false&&(!sourceMeta[s.id]?.updatedAt || Date.now()-sourceMeta[s.id].updatedAt>86400000)))void refresh();
}
function schedule(clean=false) {
 if(!clean&&queuedScan)return queuedScan;
 const run=queue.then(()=>update(clean));
 if(clean){queue=run.catch(()=>{});return run}
 const tracked=run.finally(()=>{if(queuedScan===tracked)queuedScan=undefined});
 queuedScan=tracked;
 queue=tracked.catch(()=>{});
 return tracked;
}
// The slate icon alone shows the state; there is deliberately no badge. States: idle, working, clean, findings.
async function icon(state) {
 await chrome.action.setIcon({path:{16:`icons/${state}-16.png`,32:`icons/${state}-32.png`}});
}
async function update(clean) {
 // Lets an open settings page show the running scan or cleanup, whoever started it.
 // A cleanup starts as a check and only becomes a cleanup when there is something to delete.
 await chrome.storage.session.set({activity:{type:'scan',startedAt:Date.now()}});
 try {
  await chrome.action.setBadgeText({text:''});
  await icon('working');
  const {blocked,whitelist,deleteCookies}=await rules();
  let found=await inspect(chrome,blocked,whitelist,deleteCookies), result;
  if(clean&&(found.history.length||found.cookies.length)) {
   await chrome.storage.session.set({activity:{type:'clean',startedAt:Date.now()}});
   await chrome.action.setTitle({title:t('actionCleaning')});
   result=await erase(chrome,found); found=await inspect(chrome,blocked,whitelist,deleteCookies);
  }
  const count=countDomains(found,blocked);
  const failed=result?.failed||0;
  await icon(failed||count?'findings':'clean');
  const title=failed?t('actionRequired'):count?t('actionAvailable'):t('actionCurrent');
  await chrome.action.setTitle({title});
  await chrome.storage.local.set({status:{domains:count,history:found.history.length,cookies:found.cookies.length,failed,checkedAt:Date.now(),...(result?{lastClean:result}:{})}});
 } catch(e) {
  await icon('findings');
  await chrome.action.setTitle({title:t('actionOpenSettings')});
  await chrome.storage.local.set({status:{error:'scan',checkedAt:Date.now()}});
 } finally {
  await chrome.storage.session.remove('activity');
 }
}
chrome.action.onClicked.addListener(()=>{void schedule(true)});
chrome.runtime.onInstalled.addListener(()=>{
 chrome.contextMenus.removeAll(()=>chrome.contextMenus.create({id:'settings',title:t('contextSettings'),contexts:['action']}));
 void setup();
});
chrome.runtime.onStartup.addListener(()=>{void setup()});
chrome.contextMenus.onClicked.addListener(info=>{if(info.menuItemId==='settings') chrome.runtime.openOptionsPage()});
chrome.alarms.onAlarm.addListener(alarm=>{
 if(alarm.name==='sources')void refresh();
 else if(alarm.name==='scan')void schedule();
});
chrome.storage.onChanged.addListener((changes,area)=>{
 if(area!=='local')return;
 if(changes.scanIntervalMinutes)void configureScanAlarm();
 if(changes.domains||changes.blacklist||changes.whitelist||changes.deleteCookies||changes.sourceSettings||changes.customSources||changes.removedBuiltInSources){invalidateRules();void schedule()}
});
chrome.permissions.onRemoved.addListener(permissions=>{
 if(permissions.permissions?.includes('cookies')||permissions.origins?.some(origin=>origin==='http://*/*'||origin==='https://*/*')){
  invalidateRules();
  void chrome.storage.local.set({deleteCookies:false});
 }
});
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 if(sender.id!==chrome.runtime.id || !['scan','clean','refresh'].includes(msg?.type)) return;
 (msg.type==='refresh'?refresh():schedule(msg.type==='clean')).then(()=>reply({ok:true}),()=>reply({ok:false}));return true;
});
