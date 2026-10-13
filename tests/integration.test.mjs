import test from 'node:test';
import assert from 'node:assert/strict';
import nextEnv from '@next/env';
import {sql,pool,transaction} from '../lib/db.mjs';
nextEnv.loadEnvConfig(process.cwd());
const base=process.env.TEST_URL||'http://127.0.0.1:3000';
async function request(path,method='GET',body,cookie='',origin=base){
 const response=await fetch(base+'/api/'+path,{method,headers:{'Content-Type':'application/json',origin,...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});
 return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
test('end-to-end database and role workflow',{timeout:120000},async()=>{
 const email=`test-${Date.now()}@pantrychef.invalid`;let uid,recipeId;
 try{
  assert.equal((await request('admin')).status,401);
  const meta=(await request('meta')).data;assert.equal(meta.ingredients.length,84);
  const mushroom=meta.ingredients.find(i=>i.name==='mushroom').ingredient_id;
  const garlic=meta.ingredients.find(i=>i.name==='garlic').ingredient_id;
  const searched=await request('recipes?ingredients='+mushroom);assert.equal(searched.status,200);assert.ok(searched.data.total>0);
  for(const r of searched.data.recipes){const ingredients=await sql('SELECT 1 FROM recipe_ingredients WHERE recipe_id=$1 AND ingredient_id=$2 AND NOT is_optional',[r.recipe_id,mushroom]);assert.equal(ingredients.length,1);}
  const semantic=await request('recipes?mode=semantic&q=creamy%20pasta');assert.equal(semantic.status,200);assert.ok(Number(semantic.data.recipes[0].similarity)>0);
  const keyword=await request('recipes?mode=text&q=chicken');assert.ok(keyword.data.total>0);
  const noMatch=await request('recipes?mode=text&q=zzzzunfindableword');assert.equal(noMatch.data.total,0);
  const pantryNames=['chicken breast','rice','onion','garlic','tomato'];
  const pantryIds=pantryNames.map(name=>meta.ingredients.find(i=>i.name===name).ingredient_id);
  const complete=await request('recipes?ready=true&ingredients='+pantryIds.join(','));
  assert.ok(complete.data.recipes.some(r=>r.title==='One-Pot Tomato Chicken Rice'&&Number(r.match_pct)===100));
  const signup=await request('auth/register','POST',{name:'Integration Chef',email,password:'long-test-password-123',role:'admin'});
  assert.equal(signup.status,200);assert.equal(signup.data.user.role,'user');uid=signup.data.user.user_id;const cookie=signup.cookie;
  assert.ok(cookie);assert.equal((await request('admin','GET',undefined,cookie)).status,403);
  assert.equal((await request('auth/login','POST',{email,password:'wrong'})).status,401);
  assert.equal((await request('pantry','PUT',{ingredientIds:[mushroom]},cookie,'https://untrusted.example')).status,403);
  assert.equal((await request('pantry','PUT',{ingredientIds:[mushroom,garlic]},cookie)).status,200);
  assert.deepEqual((await request('pantry','GET',undefined,cookie)).data.ingredientIds.sort((a,b)=>a-b),[mushroom,garlic].sort((a,b)=>a-b));
  assert.equal((await request('pantry','PUT',{ingredientIds:[999999]},cookie)).status,400);
  const submitted=await request('recipes','POST',{title:'Integration Mushroom Skillet',cuisine:'Italian',instructions:'Saute the mushroom and garlic together until tender and serve warm.',prep_time_min:10,difficulty:'Easy',ingredients:[{ingredient_id:mushroom,quantity:1,unit:'cup',is_optional:false},{ingredient_id:garlic,quantity:1,unit:'tsp',is_optional:false}]},cookie);
  assert.equal(submitted.status,200);assert.equal(submitted.data.status,'pending');recipeId=submitted.data.recipe_id;
  assert.equal((await request('recipes/'+recipeId)).status,404);
  assert.equal((await request('recipes/'+recipeId,'PATCH',{status:'approved'},cookie)).status,403);
  const admin=await request('auth/login','POST',{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD});assert.equal(admin.status,200);
  assert.equal((await request('recipes/'+recipeId,'GET',undefined,admin.cookie)).status,200);
  assert.equal((await request('recipes/'+recipeId,'PATCH',{status:'approved'},admin.cookie)).status,200);
  assert.equal((await request('recipes/'+recipeId)).status,200);
  const ready=await request('recipes?ingredients='+[mushroom,garlic].join(',')+'&ready=true');assert.ok(ready.data.recipes.some(r=>r.recipe_id===recipeId&&Number(r.match_pct)===100));
  assert.equal((await request('saved/'+recipeId,'POST',{},cookie)).status,200);
  assert.ok((await request('saved','GET',undefined,cookie)).data.recipes.some(r=>r.recipe_id===recipeId));
  assert.equal((await request('ratings/'+recipeId,'PUT',{stars:6},cookie)).status,400);
  assert.equal((await request('ratings/'+recipeId,'PUT',{stars:5,review:'Delicious test recipe'},cookie)).status,200);
  assert.equal(Number((await request('recipes/'+recipeId)).data.recipe.avg_rating),5);
  assert.equal((await request('ratings/'+recipeId,'PUT',{stars:2},cookie)).status,200);
  assert.equal(Number((await request('recipes/'+recipeId)).data.recipe.avg_rating),2);
  assert.equal((await request('ratings/'+recipeId,'DELETE',undefined,cookie)).status,200);
  assert.equal(Number((await request('recipes/'+recipeId)).data.recipe.avg_rating),0);
  assert.equal((await request('saved/'+recipeId,'DELETE',undefined,cookie)).status,200);
  assert.equal((await request('pantry','DELETE',undefined,cookie)).status,200);
  assert.equal((await request('recipes/'+recipeId,'DELETE',undefined,admin.cookie)).status,200);
  assert.equal((await request('auth/logout','POST',{},cookie)).status,200);
  assert.equal((await request('pantry','GET',undefined,cookie)).status,401);
  await request('auth/logout','POST',{},admin.cookie);
 }finally{
  if(recipeId)await sql('DELETE FROM recipes WHERE recipe_id=$1',[recipeId]);
  if(uid)await sql('DELETE FROM users WHERE user_id=$1',[uid]);
 }
});
test('recipe creation is atomic when a foreign key fails',{timeout:15000},async()=>{
 await assert.rejects(()=>transaction(async client=>{
  const {rows}=await client.query("INSERT INTO recipes(title,instructions,prep_time_min,difficulty,is_sample) VALUES('ROLLBACK_TEST','Test instructions',10,'Easy',false) RETURNING recipe_id");
  await client.query('INSERT INTO recipe_ingredients(recipe_id,ingredient_id,quantity,unit) VALUES($1,999999,1,\'cup\')',[rows[0].recipe_id]);
 }));
 assert.equal((await sql("SELECT 1 FROM recipes WHERE title='ROLLBACK_TEST'")).length,0);
});
test.after(async()=>{await pool().end();globalThis.pantryPool=null;});
