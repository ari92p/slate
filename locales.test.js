import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL(`./${file}`,import.meta.url),'utf8');
const english=JSON.parse(read('_locales/en/messages.json'));
const keys=Object.keys(english);
const html=read('options.html'),manifest=read('manifest.json');
const scripts=['options.js','background.js','sources.js','i18n.js'].map(read).join('\n');

test('every English message is complete', ()=>{
 for(const [key,value] of Object.entries(english)){
  assert(value.message.trim(),`${key} is empty`);
  const tokens=(value.message.match(/\$[A-Z]+\$/g)??[]).map(token=>token.slice(1,-1).toLowerCase());
  assert.deepEqual(tokens.sort(),Object.keys(value.placeholders??{}).sort(),`${key} placeholders`);
 }
});

test('every message key that is used exists, and every key is used', ()=>{
 const used=new Set([
  ...[...html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)].map(match=>match[1]),
  ...[...manifest.matchAll(/__MSG_(\w+)__/g)].map(match=>match[1]),
 ]);
 // Keys appear in scripts as string literals, also inside ternaries and state objects.
 for(const [,literal] of scripts.matchAll(/'([A-Za-z0-9]+)'/g))if(keys.includes(literal))used.add(literal);
 for(const key of used)assert(keys.includes(key),`missing message: ${key}`);
 assert.deepEqual(keys.filter(key=>!used.has(key)),[],'unused messages');
});
