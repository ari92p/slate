export const sources=[
 {id:'hagezi',name:'HaGeZi',bundledCount:92403,url:'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard/nsfw-onlydomains.txt',builtIn:true,minimumCount:1000},
 {id:'blocklistproject',name:'Block List Project',bundledCount:953197,url:'https://raw.githubusercontent.com/blocklistproject/Lists/main/porn.txt',builtIn:true,minimumCount:1000}
];

export function sourceOrigin(value) {
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password)throw Error('Only public HTTPS addresses are allowed.');
 return `${url.origin}/*`;
}

// A custom list with the address of a bundled list is that bundled list: restore it instead of keeping a copy.
export function mergeBuiltInDuplicates({customSources=[],removedBuiltInSources=[],sourceSettings={}}) {
 const byUrl=new Map(sources.map(source=>[source.url,source]));
 const duplicates=customSources.filter(source=>byUrl.has(source?.url));
 if(!duplicates.length)return null;
 const settings={...sourceSettings},restored=new Set();
 for(const duplicate of duplicates) {
  const builtIn=byUrl.get(duplicate.url);
  restored.add(builtIn.id);
  if(settings[duplicate.id])settings[builtIn.id]={enabled:settings[duplicate.id].enabled!==false};
  delete settings[duplicate.id];
 }
 return {
  customSources:customSources.filter(source=>!byUrl.has(source?.url)),
  removedBuiltInSources:removedBuiltInSources.filter(id=>!restored.has(id)),
  sourceSettings:settings,
  mergedIds:duplicates.map(source=>source.id),
 };
}

export function sourceDefinitions(customSources=[],removedBuiltInSources=[]) {
 const removed=new Set(removedBuiltInSources);
 const valid=customSources.filter(src=>{
  try {
   return typeof src?.id==='string'&&src.id.startsWith('custom-')&&typeof src.name==='string'&&src.name.trim()&&sourceOrigin(src.url);
  } catch {
   return false;
  }
 }).map(src=>({id:src.id,name:src.name.trim(),url:src.url,bundledCount:0,builtIn:false,minimumCount:1}));
 return [...sources.filter(source=>!removed.has(source.id)),...valid];
}

export function parseList(text,{minimumCount=1000}={}) {
 const domains=new Set();let invalid=0;
 for(const line of text.split(/\r?\n/)) {
  const raw=line.split('#')[0].trim();if(!raw)continue;
  const fields=raw.split(/\s+/);const host=fields.length===1?fields[0]:['0.0.0.0','127.0.0.1'].includes(fields[0])?fields[1]:'';
  const d=host.toLowerCase().replace(/\.$/,'');
  if(d.length<=253 && d.includes('.') && !/^\d+(\.\d+){3}$/.test(d) && d.split('.').every(l=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(l))) domains.add(d);else invalid++;
 }
 if(domains.size<minimumCount || domains.size>2000000 || invalid>Math.max(100,domains.size*.01)) throw Error('Ungültige oder unvollständige Liste');
 return [...domains];
}

function validateChange(domains, baseline) {
 if(!baseline?.length)return;
 if(domains.length<baseline.length*.75||domains.length>baseline.length*1.25)throw Error('Auffällige Größenänderung');
 const next=new Set(domains);
 let retained=0;
 for(const domain of baseline)if(next.has(domain))retained++;
 if(retained/baseline.length<.8)throw Error('Auffälliger Inhaltswechsel');
}

export async function refreshSources(api,fetcher=fetch,baselines={},definitions=sources,sourceSettings={}) {
 const {sourceData={}}=await api.storage.local.get('sourceData');const next={};
 for(const src of definitions) {
  const old=sourceData[src.id];
  if(sourceSettings[src.id]?.enabled===false) {
   if(old)next[src.id]=old;
   continue;
  }
  try {
   const response=await fetcher(src.url,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(25000)});
   if(!response.ok)throw Error('Download fehlgeschlagen');
   const text=await response.text();if(text.length>80000000)throw Error('Liste zu groß');
   const domains=parseList(text,{minimumCount:src.minimumCount??1000});
   validateChange(domains,old?.domains??baselines[src.id]);
   next[src.id]={domains,updatedAt:Date.now(),checkedAt:Date.now(),error:null};
  } catch {
   next[src.id]={...old,checkedAt:Date.now(),error:'sourceUpdateError'};
  }
 }
 const sourceMeta=Object.fromEntries(definitions.map(src=>{
  const value=next[src.id];
  return [src.id,{count:value?.domains?.length??src.bundledCount,updatedAt:value?.updatedAt??null,checkedAt:value?.checkedAt??null,error:value?.error??null,enabled:sourceSettings[src.id]?.enabled!==false}];
 }));
 await api.storage.local.set({sourceData:next,sourceMeta});return next;
}
