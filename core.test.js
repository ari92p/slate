import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalize,matches,matchURL,inspect,erase} from './core.js';
test('Domains match only on hostname boundaries',()=>{
 assert(matches('sub.pornhub.com',['pornhub.com']));
 assert(!matches('notpornhub.com',['pornhub.com']));
 assert(!matchURL('https://example.org/?q=pornhub.com',['pornhub.com']));
 assert(!matchURL('https://pornhub.com.example.org',['pornhub.com']));
 assert.equal(normalize('https://www.Example.com/'),'www.example.com');
 assert.throws(()=>normalize('example.com/path'));
});
test('Full-time scan includes orphan cookies and excludes unrelated domains',async()=>{
 const api={history:{search:async q=>{assert.equal(q.startTime,0);return [{url:'https://pornhub.com/old'},{url:'https://example.org'}]}},cookies:{getAll:async()=>[{domain:'.pornhub.com'},{domain:'sub.xvideos.com'},{domain:'example.org'}]}};
 const found=await inspect(api,['pornhub.com','xvideos.com']);
 assert.equal(found.history.length,1);assert.equal(found.cookies.length,2);
});
test('Saturated history results trigger a larger complete query',async()=>{
 let calls=0;
 const api={history:{search:async q=>{calls++;return calls===1?Array.from({length:q.maxResults},()=>({url:'https://example.org'})):[{url:'https://pornhub.com/very-old'}]}},cookies:{getAll:async()=>[]}};
 assert.equal((await inspect(api,['pornhub.com'])).history.length,1);assert.equal(calls,2);
});
test('Removal preserves cookie scope and partition; errors remain visible',async()=>{
 let removed;
 const api={history:{deleteUrl:async()=>{throw Error('denied')}},cookies:{remove:async d=>{removed=d;return {name:d.name}}}};
 const result=await erase(api,{history:[{url:'https://pornhub.com'}],cookies:[{domain:'.pornhub.com',path:'/account',secure:true,name:'session',storeId:'0',partitionKey:{topLevelSite:'https://example.org'}}]});
 assert.deepEqual(result,{history:0,cookies:1,failed:1});
 assert.equal(removed.url,'https://pornhub.com/account');assert.equal(removed.storeId,'0');assert.equal(removed.partitionKey.topLevelSite,'https://example.org');
});
import {policy} from './core.js';
import {parseList,refreshSources,sources,sourceDefinitions,sourceOrigin} from './sources.js';
import {readFile} from 'node:fs/promises';
test('Whitelist overrides blacklist and source domains including subdomains',()=>{
 const accept=policy(['example.org','blocked.test'],['safe.example.org']);
 assert(accept('bad.example.org'));assert(!accept('safe.example.org'));assert(!accept('sub.safe.example.org'));assert(accept('blocked.test'));
});
test('Parent cookies are protected for whitelisted subdomains',async()=>{
 const api={history:{search:async()=>[{url:'https://bad.example.org'},{url:'https://safe.example.org'}]},cookies:{getAll:async()=>[{domain:'.example.org'},{domain:'bad.example.org'},{domain:'safe.example.org'}]}};
 const result=await inspect(api,new Set(['example.org']),['safe.example.org']);
 assert.equal(result.history.length,1);assert.equal(result.cookies.length,1);assert.equal(result.cookies[0].domain,'bad.example.org');
});
test('Both real bundled sources parse without broadening subdomain rules',async()=>{
 for(const source of sources){const list=parseList(await readFile(new URL('./data/'+source.id+'.txt',import.meta.url),'utf8'));assert.equal(list.length,source.bundledCount);assert(list.includes('pornhub.com'));}
});
test('Invalid downloads preserve previous list, independent source succeeds',async()=>{
 const previous=Array.from({length:1001},(_,i)=>`old${i}.example.org`);
 let saved,meta;
 const api={storage:{local:{get:async()=>({sourceData:{hagezi:{domains:previous,updatedAt:123}}}),set:async d=>{saved=d.sourceData;meta=d.sourceMeta}}}};
 await refreshSources(api,async url=>({ok:true,text:async()=>url.includes('hagezi')?'<html>error</html>':Array.from({length:1001},(_,i)=>`new${i}.example.org`).join('\n')}));
 assert.deepEqual(saved.hagezi.domains,previous);assert.equal(saved.hagezi.updatedAt,123);assert(saved.hagezi.error);assert.equal(saved.blocklistproject.domains.length,1001);assert.equal(saved.blocklistproject.error,null);
 assert.equal(meta.hagezi.count,1001);assert.equal(meta.blocklistproject.count,1001);
});
test('A same-sized but unrelated source update is rejected',async()=>{
 const baseline=Array.from({length:1001},(_,i)=>`old${i}.example.org`);
 let saved;
 const api={storage:{local:{get:async()=>({sourceData:{}}),set:async d=>{saved=d.sourceData}}}};
 await refreshSources(api,async()=>({ok:true,text:async()=>Array.from({length:1001},(_,i)=>`replacement${i}.example.org`).join('\n')}),{hagezi:baseline,blocklistproject:baseline});
 assert.equal(saved.hagezi.domains,undefined);assert(saved.hagezi.error);
 assert.equal(saved.blocklistproject.domains,undefined);assert(saved.blocklistproject.error);
});
test('Custom filter lists require HTTPS and may contain a small valid set',async()=>{
 assert.equal(sourceOrigin('https://filters.example.org/list.txt'),'https://filters.example.org/*');
 assert.throws(()=>sourceOrigin('http://filters.example.org/list.txt'));
 assert.throws(()=>sourceOrigin('https://user:secret@filters.example.org/list.txt'));
 const definitions=sourceDefinitions([{id:'custom-test',name:'My filters',url:'https://filters.example.org/list.txt'},{id:'broken',name:'Broken',url:'https://example.org/list.txt'}]);
 const custom=definitions.find(source=>source.id==='custom-test');
 assert(custom);assert.equal(custom.minimumCount,1);assert(!definitions.some(source=>source.id==='broken'));
 let saved;
 const api={storage:{local:{get:async()=>({sourceData:{}}),set:async data=>{saved=data}}}};
 await refreshSources(api,async()=>({ok:true,text:async()=>"example.org\nsub.example.net\n"}),{},[custom],{});
 assert.deepEqual(saved.sourceData['custom-test'].domains,['example.org','sub.example.net']);
 assert.equal(saved.sourceMeta['custom-test'].enabled,true);
});
test('Disabled filter lists are retained without being downloaded',async()=>{
 const custom={id:'custom-off',name:'Off',url:'https://filters.example.org/list.txt',bundledCount:0,builtIn:false,minimumCount:1};
 let fetches=0,saved;
 const existing={domains:['example.org'],updatedAt:123,error:null};
 const api={storage:{local:{get:async()=>({sourceData:{'custom-off':existing}}),set:async data=>{saved=data}}}};
 await refreshSources(api,async()=>{fetches++;throw Error('must not fetch')},{},[custom],{'custom-off':{enabled:false}});
 assert.equal(fetches,0);assert.deepEqual(saved.sourceData['custom-off'],existing);assert.equal(saved.sourceMeta['custom-off'].enabled,false);
});
import {countDomains} from './core.js';
test('Badge counts domains once across URLs, cookies and subdomains',()=>{
 const found={history:[{url:'https://www.example.org/a'},{url:'https://example.org/b'},{url:'https://cdn.example.org/c'},{url:'https://other.test/a'}],cookies:[{domain:'.example.org'},{domain:'www.example.org'},{domain:'.other.test'}]};
 assert.equal(countDomains(found,new Set(['example.org','cdn.example.org','other.test'])),2);
 assert.equal(countDomains({history:[],cookies:[]},new Set(['example.org'])),0);
});
test('Cookie option off preserves cookies and excludes cookie-only findings',async()=>{
 let reads=0, removals=0;
 const api={history:{search:async()=>[{url:'https://example.org/a'}],deleteUrl:async()=>{}},cookies:{getAll:async()=>{reads++;return [{domain:'.example.org'}]},remove:async()=>{removals++}}};
 const found=await inspect(api,['example.org'],[],false);
 assert.equal(found.history.length,1);assert.equal(found.cookies.length,0);
 await erase(api,found);assert.equal(reads,0);assert.equal(removals,0);
 const enabled=await inspect(api,['example.org'],[],true);
 assert.equal(reads,1);assert.equal(enabled.cookies.length,1);
});
