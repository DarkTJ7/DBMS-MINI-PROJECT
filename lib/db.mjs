import pg from 'pg';
import {AsyncLocalStorage} from 'node:async_hooks';
const { Pool } = pg;
const requestDatabase=new AsyncLocalStorage();
// Only a server-derived session digest crosses this boundary, never a client role/ID.
export function withDatabaseSession(hash,callback){return requestDatabase.run({hash},callback);}
export function pool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing. Run the setup first.');
  if (!globalThis.pantryPool) {
   globalThis.pantryPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
   globalThis.pantryPool.on('error',e=>console.error('Idle database connection:',e.code));
  }
  return globalThis.pantryPool;
}
export function runtimePool(){
 if(!process.env.RUNTIME_DATABASE_URL)throw new Error('Run db:setup to provision the restricted runtime database login.');
 if(!globalThis.pantryRuntimePool){
  globalThis.pantryRuntimePool=new Pool({connectionString:process.env.RUNTIME_DATABASE_URL,max:10,connectionTimeoutMillis:5000});
  globalThis.pantryRuntimePool.on('error',e=>console.error('Idle runtime database connection:',e.code));
 }
 return globalThis.pantryRuntimePool;
}
// Privileged auth operations and maintenance only. Ordinary API queries use sql().
export async function ownerSql(text,values=[]){return (await pool().query(text,values)).rows;}
export async function sql(text, values=[]) {
 if(!requestDatabase.getStore())return ownerSql(text,values);
 return transaction(async client=>(await client.query(text,values)).rows);
}
export async function transaction(callback) {
 const context=requestDatabase.getStore();
 const client=await (context?runtimePool():pool()).connect();
 try { await client.query('BEGIN');
  if(context)await client.query("SELECT set_config('pantrychef.session_hash',$1,true)",[context.hash||'']);
  const result=await callback(client); await client.query('COMMIT'); return result; }
 catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}
