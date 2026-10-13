import { existsSync,readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import nextEnv from '@next/env';
import pg from 'pg';
import { hashPassword } from '../lib/security.mjs';
import { keepDatabaseAlive } from './wsl.mjs';
import {starterRecipes} from './starter-recipes.mjs';
import {embed} from '../lib/embeddings.mjs';
const {Pool}=pg;
const {loadEnvConfig}=nextEnv;
function wsl(args,input='') { return execFileSync('wsl',['-d','Ubuntu','-u','postgres','--',...args],{input,encoding:'utf8',stdio:['pipe','pipe','pipe']}); }
let keepalive;
try {
 if(!existsSync('.env.local')) {
  const dbPassword=randomBytes(24).toString('hex'), adminPassword=randomBytes(12).toString('base64url');
  writeFileSync('.env.local',`DATABASE_URL=postgresql://pantrychef_app:${dbPassword}@127.0.0.1:5432/pantrychef_app\nAPP_ORIGIN=http://localhost:3000\nADMIN_EMAIL=admin@pantrychef.local\nADMIN_PASSWORD=${adminPassword}\n`);
  console.log('Created .env.local with generated credentials. Keep this file private.');
 }
 loadEnvConfig(process.cwd());
 keepalive=keepDatabaseAlive();
 const uri=new URL(process.env.DATABASE_URL);
 const local=uri.hostname==='127.0.0.1'&&uri.pathname==='/pantrychef_app'&&uri.username==='pantrychef_app';
 if(local&&process.platform==='win32') {
  try{execFileSync('wsl',['-d','Ubuntu','-u','root','--','pg_ctlcluster','16','main','start'],{stdio:'pipe'});}catch(e){if(e.status!==2)throw e;}
  const roleExists=wsl(['psql','-X','-At','-d','postgres','-c',"SELECT 1 FROM pg_roles WHERE rolname='pantrychef_app'"]).trim();
  if(!roleExists)wsl(['psql','-X','-v','ON_ERROR_STOP=1','-d','postgres'],`CREATE ROLE pantrychef_app LOGIN PASSWORD '${decodeURIComponent(uri.password).replaceAll("'","''")}';`);
  const dbExists=wsl(['psql','-X','-At','-d','postgres','-c',"SELECT 1 FROM pg_database WHERE datname='pantrychef_app'"]).trim();
  if(!dbExists) {
   wsl(['createdb','-O','pantrychef_app','pantrychef_app']);
   const seed=readFileSync('database/pantrychef_seed_dump.sql','utf8').replaceAll('OWNER TO postgres','OWNER TO pantrychef_app');
   wsl(['psql','-X','-v','ON_ERROR_STOP=1','-d','pantrychef_app'],seed);
   console.log('Restored sample data into a new pantrychef_app database.');
  }
 }
 const pool=new Pool({connectionString:process.env.DATABASE_URL});
 pool.on('error',e=>console.error('Database connection was interrupted:',e.code));
 try{
  const applied=await pool.query("SELECT to_regclass('public.app_sessions') AS table_name");
  if(!applied.rows[0].table_name)await pool.query(readFileSync('database/app.sql','utf8'));
  await pool.query(readFileSync('database/integrity.sql','utf8'));
  const adminEmail=process.env.ADMIN_EMAIL;
  const adminPassword=process.env.ADMIN_PASSWORD;
  if(!adminEmail||!adminPassword||adminPassword.length<10)throw new Error('Set ADMIN_EMAIL and a password of at least 10 characters in .env.local.');
  await pool.query(`INSERT INTO users(name,email,password_hash,role) VALUES('PantryChef Admin',$1,$2,'admin')
   ON CONFLICT(email) DO NOTHING`,[adminEmail,hashPassword(adminPassword)]);
  if(!existsSync('.generated/lsa.json')) {
   console.log('Training 128-dimensional TF-IDF/SVD embeddings...');
   const {rows}=await pool.query(`SELECT r.recipe_id, r.title||' '||r.instructions||' '||string_agg(i.name,' ') AS text
    FROM recipes r JOIN recipe_ingredients ri USING(recipe_id) JOIN ingredients i USING(ingredient_id)
    WHERE r.embedding IS NOT NULL GROUP BY r.recipe_id ORDER BY r.recipe_id`);
   const result=JSON.parse(execFileSync(process.env.PYTHON_BIN||'python',['scripts/train_embeddings.py'],{input:JSON.stringify(rows),encoding:'utf8',maxBuffer:20*1024*1024}));
   const client=await pool.connect();
   try{await client.query('BEGIN');for(let i=0;i<rows.length;i++)await client.query('UPDATE recipes SET embedding=$1::vector WHERE recipe_id=$2',['['+result.vectors[i].join(',')+']',rows[i].recipe_id]);await client.query('COMMIT');}
   catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
   mkdirSync('.generated',{recursive:true});writeFileSync('.generated/lsa.json',JSON.stringify(result.model));
   await pool.query('REINDEX INDEX idx_recipes_embedding');await pool.query('ANALYZE');
  }
  const adminId=(await pool.query('SELECT user_id FROM users WHERE email=$1',[adminEmail])).rows[0].user_id;
  for(const recipe of starterRecipes){
   const exists=await pool.query('SELECT 1 FROM recipes WHERE title=$1 AND NOT is_sample',[recipe.title]);
   if(exists.rows.length)continue;
   const client=await pool.connect();
   try{
    await client.query('BEGIN');
    const vector=embed(recipe.title+' '+recipe.instructions+' '+recipe.ingredients.map(i=>i[0]).join(' '));
    const {rows}=await client.query(`INSERT INTO recipes(title,cuisine,instructions,prep_time_min,difficulty,embedding,created_by,is_sample)
     VALUES($1,$2,$3,$4,'Easy',$5::vector,$6,false) RETURNING recipe_id`,[recipe.title,recipe.cuisine,recipe.instructions,recipe.minutes,vector,adminId]);
    for(const [name,quantity,unit,optional=false] of recipe.ingredients){
     const {rows:ingredients}=await client.query('SELECT ingredient_id FROM ingredients WHERE name=$1',[name]);
     await client.query('INSERT INTO recipe_ingredients(recipe_id,ingredient_id,quantity,unit,is_optional) VALUES($1,$2,$3,$4,$5)',[rows[0].recipe_id,ingredients[0].ingredient_id,quantity,unit,optional]);
    }
    await client.query('COMMIT');
   }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }
  const {rows}=await pool.query('SELECT count(*) AS recipes FROM recipes');
  console.log(`Setup complete: ${rows[0].recipes} recipes. Start with npm run dev. Admin credentials are in .env.local.`);
 }finally{await pool.end();}
}catch(e){console.error('Setup failed:',e.message.replace(/postgresql:\/\/[^\s]+/g,'[database URL]'));process.exitCode=1;}finally{keepalive?.kill();}
