import test from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import {photoForRecipe,photos,assignments} from '../lib/recipe-photos.mjs';

test('recipe photos follow dish names consistently across recipe IDs',()=>{
 const cases={
  'Creamy Garlic Mushroom Pasta':'mushroom-pasta',
  'Garlic Butter Mushrooms':'mushrooms',
  'Mushroom Garlic Rice':'mushroom-rice',
  'One-Pot Tomato Chicken Rice':'chicken-rice',
  'Simple Tomato Garlic Rice':'tomato-rice',
  'Spinach Cheese Breakfast Bake':'spinach-bake',
  'A New Shrimp Dish':'shrimp',
  'A New Paneer Dish':'paneer',
  'A New Tofu Dish':'tofu'
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
  assert.match(p.src,/^\/food\/[a-z0-9-]+\.jpg$/);
  await access(new URL('../public'+p.src,import.meta.url));
  assert.match(p.source,/^https:\/\/commons\.wikimedia\.org\//);
  assert.ok(p.author&&p.license&&p.subject);
  assert.ok(credits.includes(p.source));
 }
});


test('every existing recipe has a distinct photo file and identical views agree',async()=>{
 const {createHash}=await import('node:crypto');
 assert.equal(assignments.length,906);
 const files=new Set(),sources=new Set(),hashes=new Set();
 for(const a of assignments){
  const p=photoForRecipe({recipe_id:a.id,title:a.title});
  assert.equal(p.key,a.photo);
  assert.ok(!files.has(p.src),`Repeated path for ${a.title}`);files.add(p.src);
  assert.ok(!sources.has(p.source),`Repeated source for ${a.title}`);sources.add(p.source);
  const bytes=await readFile(new URL('../public'+p.src,import.meta.url));
  const hash=createHash('sha256').update(bytes).digest('hex');
  assert.ok(!hashes.has(hash),`Repeated image contents for ${a.title}`);hashes.add(hash);
  assert.equal(photoForRecipe({recipe_id:a.id,title:a.title}).src,p.src);
 }
});

test('the reported chicken soup and two pilafs use different appropriate images',()=>{
 const titles=['Mediterranean Chicken Breast Soup','Mexican Chicken Breast Pilaf','American Chicken Breast Pilaf'];
 const selected=titles.map(title=>{
  const a=assignments.find(a=>a.title===title);assert.ok(a);
  return photoForRecipe({recipe_id:a.id,title});
 });
 assert.equal(new Set(selected.map(p=>p.src)).size,3);
 assert.match(selected[0].title,/soup/i);
 assert.match(selected[1].title,/pilaf|rice|pelau|polao|pilau/i);
 assert.match(selected[2].title,/pilaf|rice|pelau|polao|pilau/i);
 // An edit cannot carry a stale photograph from the original assigned dish.
 const original=assignments.find(a=>a.title===titles[0]);
 assert.notEqual(photoForRecipe({recipe_id:original.id,title:'New Garlic Mushrooms'}).src,selected[0].src);
});
