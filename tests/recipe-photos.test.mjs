import test from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import {photoForRecipe,photos} from '../lib/recipe-photos.mjs';

test('recipe photos follow dish names consistently across recipe IDs',()=>{
 const cases={
  'Creamy Garlic Mushroom Pasta':'mushroom-pasta',
  'Garlic Butter Mushrooms':'mushrooms',
  'Mushroom Garlic Rice':'mushroom-rice',
  'One-Pot Tomato Chicken Rice':'chicken-rice',
  'Simple Tomato Garlic Rice':'tomato-rice',
  'Spinach Cheese Breakfast Bake':'spinach-bake',
  'Thai Shrimp Soup':'shrimp',
  'Indian Paneer Salad':'paneer',
  'Vietnamese Tofu Noodles':'tofu'
 };
 for(const [title,key] of Object.entries(cases)){
  assert.equal(photoForRecipe({title,recipe_id:1}).key,key);
  assert.equal(photoForRecipe({title,recipe_id:999}).key,key);
 }
 assert.ok(photoForRecipe({title:'New community dish'}).src);
});

test('every photo is bundled locally and has a source and license credit',async()=>{
 const credits=await readFile(new URL('../public/photo-credits.html',import.meta.url),'utf8');
 const seen=new Set();
 for(const p of photos){
  assert.ok(!seen.has(p.key));seen.add(p.key);
  assert.match(p.src,/^\/food\/[a-z-]+\.jpg$/);
  await access(new URL('../public'+p.src,import.meta.url));
  assert.match(p.source,/^https:\/\/commons\.wikimedia\.org\//);
  assert.ok(p.author&&p.license&&p.subject);
  assert.ok(credits.includes(p.source));
 }
});
