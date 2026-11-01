import recipes from '../data/meat-recipes.mjs';
export const catalogVersion='seven-proteins-500-v2';
const proteins=new Set(['chicken','chicken breast','fish','salmon','tuna','mutton','beef','ground beef','lamb','shrimp','lobster']);
export async function installMeatCatalog(pool,adminId){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(8042,2)');
  if((await client.query('SELECT 1 FROM recipe_catalog_imports WHERE version=$1',[catalogVersion])).rows.length){await client.query('COMMIT');return false;}
  await client.query('ALTER TABLE recipes ADD COLUMN IF NOT EXISTS catalog_details jsonb');
  await client.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_source_key ON recipes((catalog_details->>'sourceKey')) WHERE catalog_details ? 'sourceKey'");
  // Retain removed imports and their saves/reviews, but withdraw them from discovery.
  await client.query("UPDATE recipes SET status='rejected' WHERE catalog_details ? 'sourceKey' AND NOT coalesce((catalog_details->>'modified')::boolean,false) AND NOT (catalog_details->>'sourceKey'=ANY($1::text[]))",[recipes.map(r=>r.key)]);
  for(const recipe of recipes){
   const exists=await client.query("SELECT 1 FROM recipes WHERE catalog_details->>'sourceKey'=$1",[recipe.key]);if(exists.rows.length)continue;
   const details={sourceKey:recipe.key,source:recipe.source,ingredients:recipe.ingredients,steps:recipe.steps,time:recipe.time,servings:recipe.servings,proteins:recipe.proteins};
   const {rows}=await client.query(`INSERT INTO recipes(title,cuisine,instructions,prep_time_min,difficulty,created_by,is_sample,status,catalog_details)
    VALUES($1,$2,$3,$4,$5,$6,false,'approved',$7::jsonb) RETURNING recipe_id`,[recipe.title,recipe.cuisine,recipe.steps.join('\n\n'),recipe.minutes,recipe.difficulty,adminId,JSON.stringify(details)]);
   const grouped=new Map();for(const line of recipe.ingredients){const old=grouped.get(line.name);grouped.set(line.name,{name:line.name,optional:old?old.optional&&line.optional:line.optional});}
   for(const ingredient of grouped.values()){
    const {rows:ings}=await client.query(`INSERT INTO ingredients(name,category) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET name=excluded.name RETURNING ingredient_id`,[ingredient.name,proteins.has(ingredient.name)?'Protein':'Pantry']);
    // Exact source measurements remain in catalog_details; never invent a number.
    await client.query('INSERT INTO recipe_ingredients(recipe_id,ingredient_id,quantity,unit,is_optional) VALUES($1,$2,NULL,NULL,$3)',[rows[0].recipe_id,ings[0].ingredient_id,ingredient.optional]);
   }
  }
  await client.query('INSERT INTO recipe_catalog_imports(version) VALUES($1)',[catalogVersion]);await client.query('COMMIT');return true;
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
