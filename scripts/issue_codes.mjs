#!/usr/bin/env node
/**
 * Issue Diana activation codes to approved students.
 * This runs on the instructor's LOCAL machine, not on GitHub Actions or Pages.
 * Usage:
 *   node scripts/issue_codes.mjs --count 10 --expires 2027-01-31 --prefix DL27
 * Requires npx Wrangler login, configured ACCESS_CODES KV namespace and permission.
 * Never commit the locally generated CSV to a public repository.
 */
import {randomInt,createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {writeFileSync,existsSync,mkdirSync} from "node:fs";
import {join,resolve,dirname} from "node:path";

const args=process.argv.slice(2);
function opt(name,fallback){const i=args.indexOf("--"+name);return i>=0?args[i+1]:fallback;}
const count=Number(opt("count","1"));
if(!Number.isInteger(count)||count<1||count>200){console.error("--count must be 1–200");process.exit(2);}
const date=opt("expires","2027-01-31");
const expires=Date.parse(date+"T23:59:59Z");
if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(expires)||expires<=Date.now()){
 console.error("Specify a valid future --expires YYYY-MM-DD date");process.exit(2);
}
const label=opt("prefix","DL27").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,30);
const output=resolve(opt("output","diana-private-codes.csv"));
if(existsSync(output)){console.error("Output file exists. Choose a new --output path.");process.exit(2);}
const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const generated=[];
for(let i=0;i<count;i++){
 let value="";for(let j=0;j<16;j++)value+=alphabet[randomInt(alphabet.length)];
 const code="DIANA-"+value.match(/.{1,4}/g).join("-");
 const key="access:"+createHash("sha256").update("DIANA"+value).digest("hex");
 const record={enabled:true,label:label+"-"+String(i+1).padStart(3,"0"),expires_at:new Date(expires).toISOString(),hourly_limit:20};
 generated.push({code,key,record});
}
const quote=value=>'"'+String(value).replaceAll('"','""')+'"';
const csv="label,activation_code,kv_key,expiry_utc\n"+
 generated.map(x=>[x.record.label,x.code,x.key,x.record.expires_at].map(quote).join(",")).join("\n")+"\n";
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,csv,{encoding:"utf-8",mode:0o600,flag:"wx"});
console.log("PRIVATE activation codes created:",output);
console.log("Never commit or share this CSV publicly. Send each student a different code using an approved private channel.");
const command=process.platform==="win32"?"npx.cmd":"npx";
try{
 for(const x of generated){
   execFileSync(command,[
     "wrangler","kv","key","put",x.key,JSON.stringify(x.record),
     "--binding","ACCESS_CODES","--remote","--config","backend/wrangler.toml"
   ],{stdio:["ignore","ignore","inherit"]});
   console.log("Provisioned",x.record.label);
 }
 console.log("Provisioning complete:",generated.length);
}catch(e){
 console.error("Some KV writes failed. Codes remain saved locally; do not distribute until verified.");
 console.error("Fix Wrangler access and retry provisioning carefully, generating no duplicates.");
 process.exit(1);
}
