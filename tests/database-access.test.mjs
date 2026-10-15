import test from 'node:test';
import assert from 'node:assert/strict';
import nextEnv from '@next/env';
import {sql,ownerSql,pool,runtimePool,withDatabaseSession} from '../lib/db.mjs';
import {newToken,tokenHash} from '../lib/security.mjs';
nextEnv.loadEnvConfig(process.cwd());

test('PostgreSQL enforces visibility, ownership and admin privileges without API guards',async()=>{
 let alice,bob,recipe;
 const a=tokenHash(newToken()),b=tokenHash(newToken()),admin=tokenHash(newToken());
 const run=(hash,query,values=[])=>withDatabaseSession(hash,()=>sql(query,values));
 try{
  [alice,bob]=(await ownerSql(`INSERT INTO users(name,email,password_hash,role)
   VALUES('RLS Alice',$1,'unusable','user'),('RLS Bob',$2,'unusable','user') RETURNING user_id`,
   [`rls-a-${Date.now()}@pantrychef.invalid`,`rls-b-${Date.now()}@pantrychef.invalid`])).map(r=>r.user_id);
  const adminId=(await ownerSql('SELECT user_id FROM users WHERE email=$1',[process.env.ADMIN_EMAIL]))[0].user_id;
  for(const [hash,id] of [[a,alice],[b,bob],[admin,adminId]])await ownerSql("INSERT INTO app_sessions VALUES($1,$2,now()+interval '5 minutes')",[hash,id]);
  const [role]=(await runtimePool().query('SELECT current_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows;
  assert.equal(role.current_user,'pantrychef_runtime');assert.equal(role.rolsuper,false);assert.equal(role.rolbypassrls,false);
  await assert.rejects(()=>run(a,"UPDATE users SET role='admin' WHERE user_id=$1",[alice]),{code:'42501'});
  await assert.rejects(()=>run(a,'SELECT password_hash FROM users'),{code:'42501'});
  await assert.rejects(()=>run(a,'SELECT * FROM app_sessions'),{code:'42501'});
  await assert.rejects(()=>run(a,'ALTER TABLE recipes ADD COLUMN unauthorized text'),{code:'42501'});
  await assert.rejects(()=>run(a,'SET ROLE pantrychef_app'),{code:'42501'});
  const ingredient=(await ownerSql('SELECT ingredient_id FROM ingredients LIMIT 1'))[0].ingredient_id;
  await run(a,'INSERT INTO user_pantry(user_id,ingredient_id,quantity) VALUES($1,$2,1)',[alice,ingredient]);
  assert.equal((await run(b,'SELECT * FROM user_pantry WHERE user_id=$1',[alice])).length,0);
  await assert.rejects(()=>run(b,'INSERT INTO user_pantry(user_id,ingredient_id,quantity) VALUES($1,$2,1)',[alice,ingredient]),{code:'42501'});
  const [row]=await run(a,"INSERT INTO recipes(title,instructions,cuisine,prep_time_min,difficulty,created_by,status,is_sample) VALUES('RLS mushroom recipe','Cook mushrooms and serve them warm.','Italian',10,'Easy',$1,'pending',false) RETURNING recipe_id",[alice]);
  recipe=row.recipe_id;
  assert.equal((await run('', 'SELECT recipe_id FROM recipes WHERE recipe_id=$1',[recipe])).length,0);
  assert.equal((await run(b,'SELECT recipe_id FROM recipes WHERE recipe_id=$1',[recipe])).length,0);
  assert.equal((await run(a,'SELECT recipe_id FROM recipes WHERE recipe_id=$1',[recipe])).length,1);
  assert.equal((await run(a,"UPDATE recipes SET status='approved' WHERE recipe_id=$1 RETURNING recipe_id",[recipe])).length,0);
  assert.equal((await run(a,'DELETE FROM recipes WHERE recipe_id=$1 RETURNING recipe_id',[recipe])).length,0);
  await assert.rejects(()=>run(b,"INSERT INTO recipes(title,instructions,created_by,status) VALUES('Forged approved recipe','This insert must never be permitted.',$1,'approved')",[bob]),{code:'42501'});
  assert.equal((await run(admin,"UPDATE recipes SET status='approved' WHERE recipe_id=$1 RETURNING recipe_id",[recipe])).length,1);
  assert.equal((await run('', 'SELECT recipe_id FROM recipes WHERE recipe_id=$1',[recipe])).length,1);
  await ownerSql("UPDATE app_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[a]);
  assert.equal((await run(a,'SELECT * FROM user_pantry')).length,0);
  // Concurrent pooled requests cannot inherit another request's transaction setting.
  const results=await Promise.all(Array.from({length:16},(_,i)=>run(i%2?b:admin,'SELECT app_actor_id() AS id')));
  results.forEach((r,i)=>assert.equal(r[0].id,i%2?bob:adminId));
  await ownerSql('DELETE FROM app_sessions WHERE token_hash=$1',[admin]);
  assert.equal((await run(admin,'DELETE FROM recipes WHERE recipe_id=$1 RETURNING recipe_id',[recipe])).length,0);
 }finally{
  if(recipe)await ownerSql('DELETE FROM recipes WHERE recipe_id=$1',[recipe]);
  await ownerSql('DELETE FROM app_sessions WHERE token_hash=ANY($1::text[])',[[a,b,admin]]);
  await ownerSql('DELETE FROM users WHERE user_id=ANY($1::int[])',[[alice,bob].filter(Boolean)]);
 }
});
test.after(async()=>{await Promise.all([pool().end(),runtimePool().end()]);globalThis.pantryPool=null;globalThis.pantryRuntimePool=null;});
