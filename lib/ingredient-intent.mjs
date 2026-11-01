const families={
 fish:['fish','salmon','tuna','rohu','pomfret','tilapia','cod','basa','seer fish','sardine','mackerel'],
 chicken:['chicken','chicken breast','chicken thigh','chicken thighs','chicken mince'],
 beef:['beef','ground beef'],prawn:['shrimp','prawn','prawns'],
};
const normalize=s=>s.toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
// Ingredient intent is a hard constraint; embeddings only order eligible recipes.
export function ingredientIntent(query,names){
 const q=normalize(query),required=[],excluded=[],covered=new Set();
 function record(words,pattern){
  const match=new RegExp(`\\b(${pattern})\\b`,'g');let hit,positive=false,negative=false;
  while((hit=match.exec(q))){
   const before=q.slice(0,hit.index);
   if(/\b(?:no|without|exclude|excluding)\s*$/.test(before))negative=true;else positive=true;
  }
  if(positive)required.push(words);if(negative)excluded.push(words);
 }
 for(const [family,words] of Object.entries(families)){
  const eligible=words.filter(n=>names.includes(n));
  const plurals=family==='fish'?'fish|fishes':family==='prawn'?'shrimp|shrimps|prawn|prawns':`${family}s?`;
  // Fish sauce is a condiment, not a portion of fish.
  record(eligible,`(?:${plurals})(?! sauce)`);
  for(const specific of words){
   if(specific===family||specific==='prawn'||specific==='prawns')continue;
   record([specific],escape(specific));
  }
  words.forEach(n=>covered.add(n));
 }
 for(const name of [...names].sort((a,b)=>b.length-a.length)){
  if(covered.has(name))continue;
  record([name],`${escape(name)}${name.endsWith('s')?'':'s?'}`);
 }
 // A deliberate OR asks for either ingredient. Other positive terms use AND.
 return {required:/\bor\b/.test(q)&&required.length?[Array.from(new Set(required.flat()))]:required,excluded};
}
