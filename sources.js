export const sources=[
 {id:'hagezi',name:'HaGeZi',bundledCount:92403,url:'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard/nsfw-onlydomains.txt'},
 {id:'blocklistproject',name:'Block List Project',bundledCount:953197,url:'https://raw.githubusercontent.com/blocklistproject/Lists/main/porn.txt'}
];
export function parseList(text) {
 const domains=new Set();let invalid=0;
 for(const line of text.split(/\r?\n/)) {
  const raw=line.split('#')[0].trim();if(!raw)continue;
  const fields=raw.split(/\s+/);const host=fields.length===1?fields[0]:['0.0.0.0','127.0.0.1'].includes(fields[0])?fields[1]:'';
  const d=host.toLowerCase().replace(/\.$/,'');
  if(d.length<=253 && d.includes('.') && !/^\d+(\.\d+){3}$/.test(d) && d.split('.').every(l=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(l))) domains.add(d);else invalid++;
 }
 if(domains.size<1000 || domains.size>2000000 || invalid>Math.max(100,domains.size*.01)) throw Error('Ungültige oder unvollständige Liste');
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

export async function refreshSources(api,fetcher=fetch,baselines={}) {
 const {sourceData={}}=await api.storage.local.get('sourceData');const next={...sourceData};
 for(const src of sources) {
  const old=sourceData[src.id];
  try {
   const response=await fetcher(src.url,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(25000)});
   if(!response.ok)throw Error('Download fehlgeschlagen');
   const text=await response.text();if(text.length>80000000)throw Error('Liste zu groß');
   const domains=parseList(text);
   validateChange(domains,old?.domains??baselines[src.id]);
   next[src.id]={domains,updatedAt:Date.now(),checkedAt:Date.now(),error:null};
  } catch {
   next[src.id]={...old,checkedAt:Date.now(),error:'Update fehlgeschlagen; bisherige Liste bleibt aktiv.'};
  }
 }
 const sourceMeta=Object.fromEntries(sources.map(src=>{
  const value=next[src.id];
  return [src.id,{count:value?.domains?.length??src.bundledCount,updatedAt:value?.updatedAt??null,checkedAt:value?.checkedAt??null,error:value?.error??null}];
 }));
 await api.storage.local.set({sourceData:next,sourceMeta});return next;
}
