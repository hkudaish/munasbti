import { execSync } from 'node:child_process';
const BASE=process.env.BASE||'http://127.0.0.1:3200',PID=process.env.SPID;
const paths=['/','/marketplace','/api/commerce/catalog','/api/catalog/services','/api/public-stats','/api/health/db'];
const rss=()=>{try{return +(execSync(`powershell -NoProfile -Command "(Get-Process -Id ${PID}).WorkingSet64/1MB"`).toString().trim()).toFixed(0)}catch{return 0}};
let target=20,stop=false,rec=null;const cur={lat:[],st:{},to:0,err:0};
const vu=async(id)=>{let k=id;while(!stop){if(id>=target){await new Promise(r=>setTimeout(r,50));continue}const p=paths[k++%paths.length],s=performance.now();try{const r=await fetch(BASE+p,{signal:AbortSignal.timeout(10000)});await r.arrayBuffer();cur.lat.push(performance.now()-s);cur.st[r.status]=(cur.st[r.status]||0)+1}catch(e){e.name==='TimeoutError'?cur.to++:cur.err++}}};
const vus=Array.from({length:500},(_,i)=>vu(i));
const pct=(a,p)=>a.length?a[Math.floor(a.length*p)]:0;
async function phase(name,n,ms){target=n;cur.lat=[];cur.st={};cur.to=0;cur.err=0;await new Promise(r=>setTimeout(r,ms));const l=[...cur.lat].sort((a,b)=>a-b);console.log(JSON.stringify({phase:name,users:n,rps:+(l.length/(ms/1000)).toFixed(0),p50:+pct(l,.5).toFixed(0),p95:+pct(l,.95).toFixed(0),p99:+pct(l,.99).toFixed(0),status:{...cur.st},timeouts:cur.to,connErr:cur.err,rssMB:rss()}))}
await phase('baseline',20,6000);await phase('SPIKE 20->500 instantly',500,10000);await phase('drain/recover 20 (first 5s)',20,5000);await phase('recovered 20',20,6000);
stop=true;await Promise.all(vus);
