import photos from '../data/food-photos.mjs';
import assignments from '../data/recipe-photo-assignments.mjs';

const catalog=new Map(photos.map(photo=>[photo.key,photo]));
const normalize=title=>String(title||'').toLowerCase().replace(/[-_]/g,' ').replace(/\s+/g,' ').trim();
const byId=new Map(assignments.map(a=>[a.id,a]));
const byTitle=new Map();
for(const a of assignments)if(!byTitle.has(normalize(a.title)))byTitle.set(normalize(a.title),a.photo);
// Existing catalogue entries have stable, distinct photographs in every view.
// Guard the title too: an edited recipe must not retain an unrelated old photo.
// New community dishes fall back to representative food-word matching.
export function photoForRecipe(recipe={}) {
 const title=normalize(recipe?.title);
 const assignment=byId.get(Number(recipe?.recipe_id));
 if(assignment&&normalize(assignment.title)===title&&catalog.has(assignment.photo))return catalog.get(assignment.photo);
 const titlePhoto=byTitle.get(title);
 if(titlePhoto&&catalog.has(titlePhoto))return catalog.get(titlePhoto);
 const has=word=>new RegExp('\\b'+word+'\\b').test(title);
 const pick=key=>catalog.get(key)||catalog.get('salad');
 if(has('mushroom')||has('mushrooms')){
  if(has('rice')||has('risotto'))return pick('mushroom-rice');
  if(has('pasta')||has('ravioli')||has('spaghetti'))return pick('mushroom-pasta');
  return pick('mushrooms');
 }
 if(has('spinach')&&(has('bake')||has('casserole')))return pick('spinach-bake');
 if(has('chicken')&&has('rice'))return pick('chicken-rice');
 if(has('tomato')&&has('rice'))return pick('tomato-rice');
 if(has('chicken')&&(has('curry')||has('masala')))return pick('curry');
 for(const [word,key] of Object.entries({salmon:'salmon',shrimp:'shrimp',prawn:'shrimp',prawns:'shrimp',tuna:'tuna',beef:'beef',pork:'pork',bacon:'pork',lamb:'lamb',tofu:'tofu',paneer:'paneer',lentil:'lentils',lentils:'lentils',dal:'lentils',chickpea:'chickpeas',chickpeas:'chickpeas',eggs:'eggs',egg:'eggs',omelette:'eggs',chicken:'chicken',turkey:'chicken'})){
  if(has(word))return pick(key);
 }
 if(has('beans')||has('bean'))return pick('beans');
 for(const [word,key] of Object.entries({tacos:'tacos',taco:'tacos',wrap:'wrap',wraps:'wrap',noodles:'noodles',noodle:'noodles',pilaf:'pilaf',pasta:'pasta',spaghetti:'pasta',salad:'salad',soup:'soup',stew:'stew',casserole:'casserole',curry:'curry'})){
  if(has(word))return pick(key);
 }
 if(title.includes('stir fry'))return pick('stir-fry');
 if(has('rice'))return pick('fried-rice');
 return pick('salad');
}

export {photos,assignments};
