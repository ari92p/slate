// Domains that versions up to 0.8.0 prefilled into the own "always clean" rules. The bundled lists cover all of them.
export const legacyDefaults = ['pornhub.com','xvideos.com','xnxx.com','xhamster.com','youporn.com','redtube.com','tube8.com','spankbang.com','eporner.com','hqporner.com','beeg.com','chaturbate.com','stripchat.com',' livejasmin.com'.trim(),'cam4.com','bongacams.com','myfreecams.com','rule34.xxx','rule34.paheal.net','e-hentai.org','exhentai.org','nhentai.net','hanime.tv'];
// One-time migration: drop the prefilled domains from stored rules, keep everything the user added.
export function migrateBlacklist({blacklist,domains,blacklistDefaultsRemoved}) {
 if(blacklistDefaultsRemoved)return null;
 const legacy=new Set(legacyDefaults);
 return (blacklist??domains??[]).filter(domain=>!legacy.has(domain));
}
export function normalize(value) {
 const raw=value.trim().toLowerCase();
 if (!raw || raw.startsWith('#')) return null;
 const u=new URL(raw.includes('://')?raw:'https://'+raw);
 if (!['http:','https:'].includes(u.protocol) || u.username || u.password || u.port || (u.pathname!=='/' && u.pathname!=='') || u.search || u.hash || !u.hostname.includes('.') || !/^[a-z0-9.-]+$/.test(u.hostname)) throw Error('Ungültige Domain: '+value);
 return u.hostname.replace(/\.$/,'');
}
export function matches(host, domains) {
 const set=domains instanceof Set?domains:new Set(domains);
 host=host.toLowerCase().replace(/^\./,'').replace(/\.$/,'');
 while(host.includes('.')) { if(set.has(host)) return true;host=host.slice(host.indexOf('.')+1); }
 return false;
}
export function policy(blocked, allowed=[]) {
 const block=new Set(blocked), allow=new Set(allowed);
 return host=>!matches(host,allow)&&matches(host,block);
}
export function matchURL(url, domains) { try { const u=new URL(url); return ['http:','https:'].includes(u.protocol) && matches(u.hostname,domains); } catch { return false; } }
export async function inspect(api, domains, whitelist=[], includeCookies=true) {
 const accepts=policy(domains,whitelist);
 // Increase the cap until every distinct URL fits; never silently use the 24-hour default.
 let cap=10000, history;
 do { history=await api.history.search({text:'',startTime:0,maxResults:cap}); if(history.length<cap) break; if(cap>=10000000) throw Error('Verlauf zu groß für vollständige Prüfung'); cap*=10; } while(true);
 const cookies=includeCookies?await api.cookies.getAll({}):[];
 return {history:history.filter(x=>{try{const u=new URL(x.url);return ['http:','https:'].includes(u.protocol)&&accepts(u.hostname)}catch{return false}}),cookies:cookies.filter(c=>accepts(c.domain)&&!whitelist.some(d=>d.endsWith('.'+c.domain.replace(/^\./,''))))};
}
// Count each matched list domain once, across URLs, subdomains and cookies.
export function countDomains(found, blocked) {
 const rules=blocked instanceof Set?blocked:new Set(blocked), seen=new Set();
 function add(host) {
  host=host.toLowerCase().replace(/^\./,'').replace(/\.$/,'');
  let domain=host;
  while(host.includes('.')) {if(rules.has(host))domain=host;host=host.slice(host.indexOf('.')+1);}
  seen.add(domain);
 }
 for(const item of found.history) {try{add(new URL(item.url).hostname)}catch{}}
 for(const cookie of found.cookies)add(cookie.domain);
 return seen.size;
}
// Start pages of every cleaned site, with and without www, over HTTPS and HTTP.
export function startPages(found, accepts=()=>true) {
 const hosts=new Set();
 for(const item of found.history) {try{hosts.add(new URL(item.url).hostname.toLowerCase().replace(/^www\./,''))}catch{}}
 const urls=[];
 for(const host of hosts)for(const name of [host,'www.'+host])if(accepts(name))for(const scheme of ['https','http'])urls.push(`${scheme}://${name}/`);
 return urls;
}
// The address bar keeps learned shortcuts until a history entry with exactly their address is deleted.
// Adding and at once deleting each start page removes the most common ones, which usually point there.
export async function forgetShortcuts(api, urls) {
 for(const url of urls) {try{await api.history.addUrl({url});await api.history.deleteUrl({url})}catch{}}
}
export async function erase(api, found) {
 let history=0,cookies=0,failed=0;
 for(const item of found.history) { try {await api.history.deleteUrl({url:item.url});history++;} catch {failed++;} }
 for(const c of found.cookies) {
  try {
   const details={url:(c.secure?'https://':'http://')+c.domain.replace(/^\./,'')+c.path,name:c.name,storeId:c.storeId};
   if(c.partitionKey) details.partitionKey=c.partitionKey;
   const result=await api.cookies.remove(details); if(result) cookies++; else failed++;
  } catch {failed++;}
 }
 return {history,cookies,failed};
}
