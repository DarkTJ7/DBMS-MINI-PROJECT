import pg from 'pg';
const { Pool } = pg;
export function pool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing. Run the setup first.');
  if (!globalThis.pantryPool) {
   globalThis.pantryPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
   globalThis.pantryPool.on('error',e=>console.error('Idle database connection:',e.code));
  }
  return globalThis.pantryPool;
}
export async function sql(text, values=[]) { return (await pool().query(text, values)).rows; }
export async function transaction(callback) {
 const client=await pool().connect();
 try { await client.query('BEGIN'); const result=await callback(client); await client.query('COMMIT'); return result; }
 catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}
