const BASE=process.env.BASE||'http://127.0.0.1:3200',O=process.env.APP_ORIGIN||'http://localhost:3200'; // run only against a TEST environment
const post=(p,b,ip)=>fetch(BASE+p,{method:'POST',headers:{'content-type':'application/json',origin:O,...(ip?{'x-forwarded-for':ip+', 203.0.113.250'}:{})},body:JSON.stringify(b)});
// A: login-ip limit: same IP, unknown identifiers
let codes={};for(let i=0;i<60;i++){const r=await post('/api/auth/login',{identifier:'ghost'+i+'@x.test',password:'x'},'203.0.113.9');codes[r.status]=(codes[r.status]||0)+1}
console.log('A same IP 60 attempts on 60 accounts:',JSON.stringify(codes));
codes={};for(let i=0;i<60;i++){const r=await post('/api/auth/login',{identifier:'ghostb'+i+'@x.test',password:'x'},'203.0.113.'+(100+i));codes[r.status]=(codes[r.status]||0)+1}
console.log('A2 rotating X-Forwarded-For 60 attempts:',JSON.stringify(codes));
// B: mass registration from one IP
codes={};let t0=Date.now();for(let i=0;i<40;i++){const r=await post('/api/auth/register',{userType:'client',customerData:{name:'bot'+i,phone:'05'+String(80000000+i),email:`bot${i}@spam.test`,password:'Passw0rd!x'+i,cityId:'riyadh'}},'198.51.100.7');codes[r.status]=(codes[r.status]||0)+1}
console.log('B 40 registrations, one IP, '+(Date.now()-t0)+'ms:',JSON.stringify(codes));
// C: register enumeration
const r1=await post('/api/auth/register',{userType:'client',customerData:{name:'dup',phone:'0580000000',email:'x@y.test',password:'Passw0rd!xz',cityId:'riyadh'}},'198.51.100.8');console.log('C duplicate phone ->',r1.status,(await r1.json()).error);
// D: account lockout via distributed guesses (victim lock DoS)
codes={};for(let i=0;i<30;i++){const r=await post('/api/auth/login',{identifier:'reem@sample.munasabati.test',password:'bad'+i},'192.0.2.'+(10+i));codes[r.status]=(codes[r.status]||0)+1}
console.log('D 30 wrong guesses from 30 spoofed IPs on one account:',JSON.stringify(codes));
const ok=await post('/api/auth/login',{identifier:'reem@sample.munasabati.test',password:'Sample-Pass-2026!'},'192.0.2.200');console.log('D victim correct password afterwards ->',ok.status,(await ok.json()).error?.slice(0,60));
