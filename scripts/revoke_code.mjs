#!/usr/bin/env node
/** Revoke a Diana student code using its hashed key from the private CSV.
 * Example:
 *   node scripts/revoke_code.mjs --kv-key access:0123...abcd
 * Run locally after npx wrangler login.
 * Does not print or require the student's raw code.
 */
import {execFileSync} from "node:child_process";
const i=process.argv.indexOf("--kv-key");
const key=i>=0?process.argv[i+1]:"";
if(!/^access:[a-f0-9]{64}$/.test(key||"")){
 console.error("Supply the exact access:<64 hex characters> key from your private code CSV.");
 process.exit(2);
}
const command=process.platform==="win32"?"npx.cmd":"npx";
try{
  execFileSync(command,[
   "wrangler","kv","key","put",key,JSON.stringify({enabled:false}),
   "--binding","ACCESS_CODES","--remote","--config","backend/wrangler.toml"
  ],{stdio:["ignore","inherit","inherit"]});
  console.log("Code revoked. Existing sessions will fail after the Cloudflare KV change propagates.");
}catch{console.error("Revocation failed. Check Cloudflare login and namespace.");process.exit(1);}
