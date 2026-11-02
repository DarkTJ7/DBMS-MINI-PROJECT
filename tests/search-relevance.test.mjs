import test from 'node:test';
import assert from 'node:assert/strict';
import nextEnv from '@next/env';
import {ingredientIntent} from '../lib/ingredient-intent.mjs';
import {findRecipes,recipeDetail} from '../lib/recipes.mjs';
import {sql,pool} from '../lib/db.mjs';
import {indianRecipes} from '../data/indian-recipes.mjs';
nextEnv.loadEnvConfig(process.cwd());
test('ingredient intent separates fish from fish sauce and supports exclusions',()=>{
 const names=['fish','salmon','tuna','fish sauce','chicken breast'];
 assert.deepEqual(ingredientIntent('fish',names).required,[['fish','salmon','tuna']]);
 assert.deepEqual(ingredientIntent('fish sauce',names).required,[['fish sauce']]);
 assert.deepEqual(ingredientIntent('fish without chicken',names).excluded,[['chicken breast']]);
});
test('fish and chicken require real ingredients in both search modes',async()=>{
 for(const mode of ['text','semantic'])for(const [q,allowed] of [['fish',['fish','salmon','tuna']],['chicken',['chicken','chicken breast']]]){
  const results=await findRecipes({mode,q});assert.ok(results.total>=10,`${mode} ${q}`);
  for(const recipe of results.recipes){
   assert.equal(recipe.is_sample,false);
   const names=await sql('SELECT i.name FROM recipe_ingredients ri JOIN ingredients i USING(ingredient_id) WHERE recipe_id=$1 AND NOT is_optional',[recipe.recipe_id]);
   assert.ok(names.some(i=>allowed.includes(i.name)),`${q} wrongly returned ${recipe.title}`);
  }
 }
 assert.equal((await findRecipes({mode:'semantic',q:'fish',diet:'vegetarian'})).total,0);
 assert.equal((await findRecipes({mode:'text',q:'zzzzunfindableword'})).total,0);
});
test('curated Indian recipes are installed with complete matching steps and ingredient quantities',async()=>{
 assert.equal(indianRecipes.length,40);
 for(const recipe of indianRecipes){
  const rows=await sql('SELECT recipe_id FROM recipes WHERE title=$1 AND NOT is_sample',[recipe.title]);assert.equal(rows.length,1,recipe.title);
  const detail=await recipeDetail(rows[0].recipe_id);
  assert.equal(detail.ingredients.length,recipe.ingredients.length);
  assert.deepEqual(detail.cooking_guide.steps,recipe.steps);
  assert.equal(detail.cooking_guide.suggested,false);
  assert.ok(recipe.steps.length>=4);
  for(const [name,quantity,unit] of recipe.ingredients){const match=detail.ingredients.find(i=>i.name===name);assert.ok(match,name);assert.equal(Number(match.quantity),quantity);assert.equal(match.unit,unit);}
 }
 const discover=await findRecipes({});assert.ok(discover.recipes.every(r=>!r.is_sample));
});

test('pantry searches include 75% and 100%, exclude 50% and 70%, and paginate after filtering',async()=>{
 const fixtures=await sql(`SELECT r.recipe_id,array_agg(ri.ingredient_id ORDER BY ri.ingredient_id) AS ids
  FROM recipes r JOIN recipe_ingredients ri USING(recipe_id)
  WHERE r.status='approved' AND NOT r.is_sample AND NOT ri.is_optional
  GROUP BY r.recipe_id HAVING count(*) IN (4,10) ORDER BY r.recipe_id`);
 const four=fixtures.find(r=>r.ids.length===4),ten=fixtures.find(r=>r.ids.length===10);
 assert.ok(four&&ten,'The catalogue must include four- and ten-ingredient recipes.');
 for(const [recipe,matched,included] of [[four,3,true],[four,4,true],[four,2,false],[ten,7,false]]){
  const ingredientIds=recipe.ids.slice(0,matched);
  const expected=await sql(`SELECT r.recipe_id FROM recipes r JOIN recipe_ingredients ri USING(recipe_id)
   WHERE r.status='approved' AND NOT r.is_sample AND NOT ri.is_optional GROUP BY r.recipe_id
   HAVING count(*) FILTER(WHERE ri.ingredient_id=ANY($1::int[]))*4>=count(*)*3`,[ingredientIds]);
  const first=await findRecipes({ingredientIds});assert.equal(first.total,expected.length);
  const found=[];
  for(let page=1;page<=Math.max(1,Math.ceil(first.total/24));page++){
   const result=page===1?first:await findRecipes({ingredientIds,page});
   assert.equal(result.total,first.total);
   for(const row of result.recipes){assert.ok(Number(row.matched)/Number(row.required)>=0.75);found.push(row.recipe_id);}
  }
  assert.deepEqual(new Set(found),new Set(expected.map(r=>r.recipe_id)));
  assert.equal(found.includes(recipe.recipe_id),included,`${matched}/${recipe.ids.length} boundary`);
  const ready=await findRecipes({ingredientIds,ready:true});
  assert.ok(ready.recipes.every(r=>Number(r.matched)===Number(r.required)));
 }
 const popularIds=(await sql(`SELECT ri.ingredient_id FROM recipe_ingredients ri JOIN recipes r USING(recipe_id)
  WHERE r.status='approved' AND NOT r.is_sample AND NOT ri.is_optional
  GROUP BY ri.ingredient_id ORDER BY count(*) DESC,ri.ingredient_id LIMIT 40`)).map(r=>r.ingredient_id);
 const page1=await findRecipes({ingredientIds:popularIds}),page2=await findRecipes({ingredientIds:popularIds,page:2});
 assert.ok(page1.total>24,'Exercise multiple result pages with a larger pantry.');
 assert.equal(page2.total,page1.total);assert.equal(page1.recipes.length,24);
 const combined=[...page1.recipes,...page2.recipes];
 assert.equal(new Set(combined.map(r=>r.recipe_id)).size,combined.length);
 assert.ok(combined.every(r=>Number(r.matched)/Number(r.required)>=0.75));
 const publicCount=Number((await sql("SELECT count(*) AS n FROM recipes WHERE status='approved' AND NOT is_sample"))[0].n);
 assert.equal((await findRecipes({})).total,publicCount,'Browsing without pantry ingredients stays available.');
});
test.after(async()=>{await pool().end();globalThis.pantryPool=null;});
