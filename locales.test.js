import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';

const read=locale=>JSON.parse(readFileSync(new URL(`./_locales/${locale}/messages.json`,import.meta.url),'utf8'));
const english=read('en');
const tokens=text=>(text.match(/\$[A-Z]+\$/g)??[]).sort();
const locales=readdirSync(new URL('./_locales/',import.meta.url)).filter(locale=>locale!=='en');

test('every locale translates every English message', ()=>{
 assert(locales.length>1);
 for(const locale of locales){
  const messages=read(locale);
  assert.deepEqual(Object.keys(messages),Object.keys(english),locale);
  for(const [key,value] of Object.entries(english)){
   assert.equal(typeof messages[key].message,'string',`${locale}.${key}`);
   assert(messages[key].message.trim(),`${locale}.${key} is empty`);
   assert.deepEqual(messages[key].placeholders,value.placeholders,`${locale}.${key} placeholders`);
   assert.deepEqual(tokens(messages[key].message),tokens(value.message),`${locale}.${key} tokens`);
  }
 }
});
