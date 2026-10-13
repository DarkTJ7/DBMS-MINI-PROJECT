import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
export class ApiError extends Error { constructor(message,status=400) { super(message);this.status=status; } }
export function hashPassword(password) { const salt=randomBytes(16).toString('hex');return `scrypt:${salt}:${scryptSync(password,salt,64).toString('hex')}`; }
export function verifyPassword(password, stored) {
 const [method,salt,digest]=stored.split(':');
 if(method!=='scrypt'||!salt||!digest) return false;
 const expected=Buffer.from(digest,'hex'), actual=scryptSync(password,salt,64);
 return expected.length===actual.length && timingSafeEqual(expected,actual);
}
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('hex');
export function text(value,label,max=200,min=1) {
 if(typeof value!=='string'||value.trim().length<min||value.trim().length>max) throw new ApiError(`${label} must be ${min}-${max} characters.`);
 return value.trim();
}
export function integer(value,label,min=1,max=2147483647) {
 const n=Number(value);if(!Number.isInteger(n)||n<min||n>max) throw new ApiError(`${label} must be an integer from ${min} to ${max}.`);return n;
}
export function ids(value) {
 if(!Array.isArray(value)||value.length>84) throw new ApiError('Choose up to 84 ingredients.');
 return [...new Set(value.map(v=>integer(v,'Ingredient ID')))];
}
export function credentials(body,signup=false) {
 const email=text(body.email,'Email',150).toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError('Enter a valid email.');
 const password=text(body.password,'Password',128,signup?10:1);
 return {email,password};
}
export function checkOrigin(request) {
 const origin=request.headers.get('origin');
 const url=new URL(request.url),host=request.headers.get('host');
 const allowed=[url.origin,process.env.APP_ORIGIN,host?`${url.protocol}//${host}`:null].filter(Boolean);
 if(origin&&!allowed.includes(origin)) throw new ApiError('Request origin is not allowed.',403);
}
// Best-effort local rate limiting; a shared store is needed for multiple servers.
export function rateLimit(key) {
 const now=Date.now();globalThis.authAttempts ||= new Map();
 for(const [k,v] of globalThis.authAttempts) if(v.until<now) globalThis.authAttempts.delete(k);
 const entry=globalThis.authAttempts.get(key)||{count:0,until:now+600000};
 if(++entry.count>20) throw new ApiError('Too many attempts. Try again in 10 minutes.',429);
 globalThis.authAttempts.set(key,entry);
}
