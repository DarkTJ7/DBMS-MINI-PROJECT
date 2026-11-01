import photos from '../data/food-photos.mjs';

const catalog=new Map(photos.map(photo=>[photo.key,photo]));
// Match food words, never recipe IDs: the same dish keeps the same photo in
// search, cookbook and details. Photos illustrate food; they are not exact recipes.
export function photoForRecipe(recipe={}) {
 const title=String(recipe?.title||'').toLowerCase().replace(/[-_]/g,' ');
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

export {photos};
