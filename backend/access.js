// Server-side Diana activation-code access control.
// Only approved codes live in Cloudflare ACCESS_CODES KV; NEVER in GitHub Pages.
// A validated code grants a signed 24-hour browser-session token.
// Codes are high-entropy random strings and stored as SHA-256 hashes.
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ALPHABET = /^[A-Z2-9]+$/;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const hex = buffer => Array.from(new Uint8Array(buffer)).map(b=>b.toString(16).padStart(2,"0")).join("");
const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
function unb64url(s) {
  if (!/^[a-zA-Z0-9_-]+$/.test(s)) throw new Error("Invalid encoding");
  return Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
}
function normaliseCode(value) {
  if (typeof value!=="string" || value.length>100) return "";
  const text=value.toUpperCase().replace(/[\s-]/g,"");
  return text.startsWith("DIANA")&&text.length===21&&ALPHABET.test(text)?text:"";
}
export async function accessKey(value) {
  const code=normaliseCode(value);
  if (!code) return null;
  return "access:"+hex(await crypto.subtle.digest("SHA-256",encoder.encode(code)));
}
async function signingKey(secret) {
  return crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
}
async function issueToken(accessKeyValue,secret,expiry) {
  const payload={v:1,key:accessKeyValue,iat:Date.now(),exp:expiry,nonce:crypto.randomUUID()};
  const raw=b64url(encoder.encode(JSON.stringify(payload)));
  const message="d1."+raw;
  const sig=b64url(new Uint8Array(await crypto.subtle.sign("HMAC",await signingKey(secret),encoder.encode(message))));
  return message+"."+sig;
}
async function parseToken(token,secret) {
  if (typeof token!=="string" || token.length>2048) return null;
  const parts=token.split(".");
  if (parts.length!==3 || parts[0]!=="d1") return null;
  try {
    const message=parts[0]+"."+parts[1];
    const valid=await crypto.subtle.verify("HMAC",await signingKey(secret),
      unb64url(parts[2]),encoder.encode(message));
    if(!valid) return null;
    const data=JSON.parse(decoder.decode(unb64url(parts[1])));
    const now=Date.now();
    if(data.v!==1 || typeof data.key!=="string" ||
       !/^access:[a-f0-9]{64}$/.test(data.key) ||
       !Number.isSafeInteger(data.iat)||!Number.isSafeInteger(data.exp) ||
       data.iat>now+60000 || data.exp<=now ||
       data.exp-data.iat>TOKEN_TTL_MS+60000) return null;
    return data;
  } catch { return null; }
}
function recordValid(obj) {
  return obj && obj.enabled===true && 
    (obj.expires_at===null||obj.expires_at===undefined||
     (typeof obj.expires_at==="string" &&
      Number.isFinite(Date.parse(obj.expires_at)) &&
      Date.parse(obj.expires_at)>Date.now()));
}
async function loadAccess(env,key) {
  if(!env.ACCESS_CODES || !key) return null;
  try {
    const data=await env.ACCESS_CODES.get(key,"json");
    return recordValid(data)?data:null;
  }catch{return null;}
}
async function rateCount(env,namespace,id,maximum) {
  // KV is eventually consistent. Add Cloudflare WAF rules for stronger protection.
  if(!env.RATE_LIMIT) return false;
  const hour=Math.floor(Date.now()/3600000);
  const digest=hex(await crypto.subtle.digest("SHA-256",encoder.encode(id+":"+hour)));
  const key=namespace+":"+digest;
  try {
    const count=Number(await env.RATE_LIMIT.get(key)||0);
    if(!Number.isFinite(count)||count>=maximum) return false;
    await env.RATE_LIMIT.put(key,String(count+1),{expirationTtl:3700});
    return true;
  } catch { return false; }
}
function clientIP(request) {
  return request.headers.get("CF-Connecting-IP")||"unknown";
}
async function validateTurnstile(env,request,token) {
  if(!env.TURNSTILE_SECRET||typeof token!=="string"||!token||token.length>2048)return false;
  const data=new FormData();
  data.set("secret",env.TURNSTILE_SECRET);
  data.set("response",token);
  data.set("remoteip",clientIP(request));
  try {
    const res=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{
      method:"POST",body:data,signal:AbortSignal.timeout(9000)});
    if(!res.ok)return false;
    const value=await res.json();
    return value.success===true&&value.hostname==="dianzdd123.github.io";
  } catch {return false;}
}
export async function activateStudent(request,env,reply,fail) {
  if(!env.ACCESS_CODES || !env.SESSION_SECRET || !env.TURNSTILE_SECRET || !env.RATE_LIMIT)
    return fail(503,"Student access is not configured.");
  let body;
  try{body=await request.json();}catch{return fail(400,"Invalid request.");}
  // Check Turnstile and IP throttle BEFORE access-code lookup to resist guessing.
  if(!await validateTurnstile(env,request,body.turnstile_token))
    return fail(403,"Human verification was not completed. Please try again.");
  if(!await rateCount(env,"activate-ip",clientIP(request),8))
    return fail(429,"Too many activation attempts. Please try again later.");
  const key=await accessKey(body.code);
  const record=await loadAccess(env,key);
  if(!record)return fail(403,"Invalid or expired activation code.");
  const codeExpiry=record.expires_at?Date.parse(record.expires_at):Infinity;
  const expiresAt=Math.min(Date.now()+TOKEN_TTL_MS,codeExpiry);
  const token=await issueToken(key,env.SESSION_SECRET,expiresAt);
  return reply({session_token:token,expires_at:new Date(expiresAt).toISOString(),
    access_label:String(record.label||"Course student").slice(0,80)});
}
export async function studentSession(request,env) {
  if(!env.ACCESS_CODES||!env.SESSION_SECRET||!env.RATE_LIMIT)
    return {ok:false,status:503,message:"Student access is not configured."};
  const header=request.headers.get("Authorization")||"";
  if(!header.startsWith("Bearer "))return {ok:false,status:401,message:"Enter your Diana activation code first."};
  const payload=await parseToken(header.slice(7),env.SESSION_SECRET);
  if(!payload)return {ok:false,status:401,message:"Your Diana session has expired. Activate again."};
  const record=await loadAccess(env,payload.key);
  if(!record)return {ok:false,status:401,message:"This access code has expired or been withdrawn."};
  return {ok:true,payload,record};
}
export async function checkStudentSession(request,env,reply,fail){
  const access=await studentSession(request,env);
  if(!access.ok)return fail(access.status,access.message);
  return reply({active:true,expires_at:new Date(access.payload.exp).toISOString(),
    access_label:String(access.record.label||"Course student").slice(0,80)});
}
export async function authoriseQuestion(request,env) {
  const student=await studentSession(request,env);
  if(!student.ok)return student;
  const requested=Number(student.record.hourly_limit||20);
  const limit=Number.isFinite(requested)?Math.max(1,Math.min(50,Math.floor(requested))):20;
  if(!await rateCount(env,"ask-code",student.payload.key,limit))
    return {ok:false,status:429,message:"Your hourly question allowance is used. Please try later."};
  return student;
}
