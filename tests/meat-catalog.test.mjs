import test from 'node:test';
import assert from 'node:assert/strict';
import nextEnv from '@next/env';
import {createHash} from 'node:crypto';
import recipes from '../data/meat-recipes.mjs';
import {findRecipes,recipeDetail} from '../lib/recipes.mjs';
import {proteinGroups} from '../lib/proteins.mjs';
import {sql,pool} from '../lib/db.mjs';
import {installMeatCatalog} from '../scripts/meat-catalog.mjs';
import {photoForRecipe} from '../lib/recipe-photos.mjs';
nextEnv.loadEnvConfig(process.cwd());
test('five hundred source recipes are distinct and preserve real methods and measurements',()=>{
 assert.equal(recipes.length,500);
 for(const getKey of [r=>r.key,r=>r.title.toLowerCase(),r=>r.source.url,r=>createHash('sha256').update(r.steps.join(' ').toLowerCase().replace(/\W/g,'')).digest('hex')])assert.equal(new Set(recipes.map(getKey)).size,500);
 for(const r of recipes){
  assert.match(r.source.url,/^https:\/\/en.wikibooks.org\/wiki\/Cookbook:/);
  assert.equal(r.source.license,'CC BY-SA 4.0');assert.ok(r.steps.length>=3);assert.ok(r.ingredients.length>=3);
  for(const protein of r.proteins)assert.ok(r.ingredients.some(i=>!i.optional&&proteinGroups[protein].includes(i.name)),r.title);
  for(const line of r.ingredients)assert.ok(line.text.trim()&&line.name.trim());
 }
 assert.deepEqual(new Set(recipes.flatMap(r=>r.proteins)),new Set(Object.keys(proteinGroups)));
});
test('installed catalogue is idempotent and source details stay intact',async()=>{
 const before=(await sql("SELECT count(*)::int AS n FROM recipes WHERE status='approved' AND catalog_details ? 'sourceKey'"))[0].n;
 assert.equal(before,500);
 const admin=(await sql("SELECT user_id FROM users WHERE role='admin' ORDER BY user_id LIMIT 1"))[0];
 assert.equal(await installMeatCatalog(pool(),admin.user_id),false);
 assert.equal((await sql("SELECT count(*)::int AS n FROM recipes WHERE status='approved' AND catalog_details ? 'sourceKey'"))[0].n,before);
 const stored=await sql("SELECT * FROM recipes WHERE status='approved' AND catalog_details ? 'sourceKey'");
 const sourceByKey=new Map(recipes.map(r=>[r.key,r]));
 for(const row of stored){const source=sourceByKey.get(row.catalog_details.sourceKey);assert.ok(source);assert.equal(row.instructions,source.steps.join('\n\n'));assert.deepEqual(row.catalog_details.ingredients,source.ingredients);assert.equal(row.is_sample,false);}
 const detail=await recipeDetail(stored[0].recipe_id);
 assert.deepEqual(detail.cooking_guide.steps,detail.catalog_details.steps);assert.equal(detail.cooking_guide.suggested,false);
 assert.equal(photoForRecipe(detail),null);
});
test('all seven protein filters and both search modes require the actual meat',async()=>{
 for(const [protein,names] of Object.entries(proteinGroups)){
  const pages=await findRecipes({protein});assert.ok(pages.total>0,protein);
  const ids=[];
  for(let page=1;page<=Math.ceil(pages.total/24);page++)ids.push(...(await findRecipes({protein,page})).recipes.map(r=>r.recipe_id));
  assert.equal(new Set(ids).size,pages.total);
  const valid=await sql('SELECT DISTINCT recipe_id FROM recipe_ingredients ri JOIN ingredients i USING(ingredient_id) WHERE recipe_id=ANY($1::int[]) AND NOT is_optional AND name=ANY($2::text[])',[ids,names]);assert.equal(valid.length,ids.length,protein);
  for(const mode of ['text','semantic']){
   const found=await findRecipes({q:protein,mode});assert.ok(found.total>0,`${mode} ${protein}`);
   const valid=await sql('SELECT DISTINCT recipe_id FROM recipe_ingredients ri JOIN ingredients i USING(ingredient_id) WHERE recipe_id=ANY($1::int[]) AND NOT is_optional AND name=ANY($2::text[])',[found.recipes.map(r=>r.recipe_id),names]);assert.equal(valid.length,found.recipes.length);
  }
  assert.equal((await findRecipes({protein,diet:'vegetarian'})).total,0);
 }
 await assert.rejects(()=>findRecipes({protein:'not-a-protein'}));
});
test.after(async()=>{await pool().end();globalThis.pantryPool=null;});
