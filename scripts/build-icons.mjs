// Renders the slate icons to icons/*.png with a headless Chromium browser.
// Usage: node scripts/build-icons.mjs   (BROWSER=/path/to/chrome to override the browser)
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const SLATE='#36434c',RIM='#7d8b93',CHALK='#efeee7';

// 16-unit grid: at 16px one unit is one pixel. The rim stays one device pixel wide at every size.
export function iconSVG(state,px){
 const rim=Math.max(16/px,.125),inset=1+rim/2;
 const tile=`<rect x="1" y="1" width="14" height="14" rx="3.5" fill="${SLATE}"/><rect x="${inset}" y="${inset}" width="${16-2*inset}" height="${16-2*inset}" rx="${3.5-rim/2}" fill="none" stroke="${RIM}" stroke-width="${rim}" stroke-opacity=".9"/>`;
 const writing=opacity=>`<g fill="${CHALK}" opacity="${opacity}"><rect x="4" y="5" width="8" height="2" rx="1"/><rect x="4" y="9" width="5" height="2" rx="1"/></g>`;
 const stroke=opacity=>`<path d="M4.2 11c2.1-.9 4.7-2.6 7.6-5.4" stroke="${CHALK}" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="${opacity}"/>`;
 const mark={
  idle:stroke(.38),                // not checked yet: a faint wiping trace
  working:writing(.42),            // checking or cleaning: chalk half wiped off
  clean:`<path d="M4.5 8.3l2.3 2.3 4.7-4.9" stroke="${CHALK}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  findings:writing(1),             // something is written: there is something to clean
  brand:stroke(1),
 }[state];
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">${tile}${mark}</svg>`;
}

const icons=[
 ...['idle','working','clean','findings'].flatMap(state=>[16,32].map(px=>({state,px,file:`${state}-${px}.png`}))),
 ...[16,32,48,128].map(px=>({state:'brand',px,file:`slate-${px}.png`})),
];

function findBrowser(){
 const candidates=[process.env.BROWSER,'/Applications/Brave Browser.app/Contents/MacOS/Brave Browser','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium','/usr/bin/google-chrome'].filter(Boolean);
 const browser=candidates.find(path=>existsSync(path));
 if(!browser)throw Error('No Chromium-based browser found. Set BROWSER=/path/to/chrome.');
 return browser;
}

async function main(){
 const profile=await mkdtemp(join(tmpdir(),'slate-icons-'));
 const port=9300+Math.floor(Math.random()*500);
 const browser=spawn(findBrowser(),['--headless=new',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
 try{
  let page;
  for(let attempt=0;attempt<100&&!page;attempt++){
   try{page=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(response=>response.json())}catch{await new Promise(resolve=>setTimeout(resolve,100))}
  }
  const socket=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
  let id=0;const waiting=new Map();
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);waiting.get(message.id)?.(message);waiting.delete(message.id)});
  const evaluate=async expression=>{const requestId=++id;const response=new Promise(resolve=>waiting.set(requestId,resolve));socket.send(JSON.stringify({id:requestId,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));const {result}=await response;if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value};
  await mkdir(join(root,'icons'),{recursive:true});
  for(const icon of icons){
   const svg=iconSVG(icon.state,icon.px);
   const dataURL=await evaluate(`new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=${icon.px};canvas.getContext('2d').drawImage(image,0,0,${icon.px},${icon.px});resolve(canvas.toDataURL('image/png'))};image.onerror=reject;image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(${JSON.stringify(svg)})})`);
   await writeFile(join(root,'icons',icon.file),Buffer.from(dataURL.split(',')[1],'base64'));
   console.log(`icons/${icon.file}`);
  }
  socket.close();
 }finally{
  const exited=new Promise(resolve=>browser.once('exit',resolve));
  browser.kill();
  await exited;
  await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
 }
}

if(process.argv[1]===fileURLToPath(import.meta.url))await main();
