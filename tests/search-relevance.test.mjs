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
test.after(async()=>{await pool().end();globalThis.pantryPool=null;});
