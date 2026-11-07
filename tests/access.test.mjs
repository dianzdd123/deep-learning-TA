import test from "node:test";
import assert from "node:assert/strict";
import {accessKey,activateStudent,studentSession,authoriseQuestion} from "../backend/access.js";

const CODE="DIANA-ABCD-EFGH-JKLM-NPQR";
function makeEnv(){
  const codes=new Map(),limits=new Map();
  const kv=m=>({
    async get(key,type){const v=m.get(key);return type==="json"&&v?JSON.parse(v):v??null;},
    async put(key,val){m.set(key,val);}
  });
  return {ACCESS_CODES:kv(codes),RATE_LIMIT:kv(limits),SESSION_SECRET:"test-very-long-secret-not-real-"+ "abc".repeat(15),
    TURNSTILE_SECRET:"fake-test-turnstile",codes,limits};
}
function reply(value,status=200){return new Response(JSON.stringify(value),{status,headers:{"Content-Type":"application/json"}});}
function bad(status,message){return reply({error:message},status);}
function question(token){return new Request("https://diana.example/ask",{method:"POST",headers:{Authorization:"Bearer "+token}});}
async function makeRequest(code,turnstile_token="TEST_TOKEN"){
  return new Request("https://diana.example/activate",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({code,turnstile_token})});
}
test("activation code is normalised to a hashed KV key",async()=>{
 const key=await accessKey(CODE);assert.match(key,/^access:[a-f0-9]{64}$/);
 assert.equal(await accessKey("diana abcdefghjklmnpqr"),key);
 assert.equal(await accessKey("bad"),null);
});
test("valid activation grants a signed session; revoked code denies reuse",async()=>{
 const env=makeEnv(),key=await accessKey(CODE);
 env.codes.set(key,JSON.stringify({enabled:true,label:"Student 001",hourly_limit:20,expires_at:new Date(Date.now()+86400000*2).toISOString()}));
 const saved=globalThis.fetch;
 globalThis.fetch=async(url)=>{assert.match(String(url),/turnstile\/v0\/siteverify/);return reply({success:true,hostname:"dianzdd123.github.io"});};
 try{
 const res=await activateStudent(await makeRequest(CODE),env,reply,bad);
 assert.equal(res.status,200);const {session_token}=await res.json();assert.ok(session_token.includes("."));
 const auth=await studentSession(question(session_token),env);assert.equal(auth.ok,true);
 const allowance=await authoriseQuestion(question(session_token),env);assert.equal(allowance.ok,true);
 env.codes.set(key,JSON.stringify({enabled:false}));
 const denied=await studentSession(question(session_token),env);assert.equal(denied.status,401);
 }finally{globalThis.fetch=saved;}
});
test("wrong code and expired code are rejected",async()=>{
 const env=makeEnv(),key=await accessKey(CODE);
 env.codes.set(key,JSON.stringify({enabled:true,label:"Expired",expires_at:"2020-01-01T00:00:00Z"}));
 const saved=globalThis.fetch;
 globalThis.fetch=async()=>reply({success:true,hostname:"dianzdd123.github.io"});
 try {
  const res=await activateStudent(await makeRequest(CODE),env,reply,bad);
  assert.equal(res.status,403);
  const wrong=await activateStudent(await makeRequest("DIANA-ZZZZ-ZZZZ-ZZZZ-ZZZZ"),env,reply,bad);
  assert.equal(wrong.status,403);
 }finally{globalThis.fetch=saved;}
});
test("missing or forged sessions are never authorised",async()=>{
 const env=makeEnv();
 assert.equal((await authoriseQuestion(new Request("https://diana.example/ask"),env)).status,401);
 assert.equal((await authoriseQuestion(question("d1.invalid.forged"),env)).status,401);
});
