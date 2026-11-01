import {indianRecipes} from '../data/indian-recipes.mjs';
const version='indian-home-kitchen-1';
export async function installIndianCatalog(pool,adminId){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(8042,1)');
  await client.query('CREATE TABLE IF NOT EXISTS recipe_catalog_imports(version text PRIMARY KEY,installed_at timestamptz NOT NULL DEFAULT now())');
  if((await client.query('SELECT 1 FROM recipe_catalog_imports WHERE version=$1',[version])).rows.length){await client.query('COMMIT');return false;}
  for(const recipe of indianRecipes){
   const existing=await client.query('SELECT recipe_id FROM recipes WHERE title=$1 AND NOT is_sample ORDER BY recipe_id LIMIT 1',[recipe.title]);
   if(existing.rows.length)continue;
   const {rows}=await client.query(`INSERT INTO recipes(title,cuisine,instructions,prep_time_min,difficulty,created_by,is_sample,status)
    VALUES($1,$2,$3,$4,'Easy',$5,false,'approved') RETURNING recipe_id`,[recipe.title,recipe.cuisine,recipe.instructions,recipe.minutes,adminId]);
   for(const [name,quantity,unit,optional=false] of recipe.ingredients){
    const category=name==='fish'?'protein':['oil','ghee','yogurt','paneer'].includes(name)?'dairy and fats':'pantry';
    const {rows:ings}=await client.query(`INSERT INTO ingredients(name,category) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET name=excluded.name RETURNING ingredient_id`,[name,category]);
    await client.query('INSERT INTO recipe_ingredients(recipe_id,ingredient_id,quantity,unit,is_optional) VALUES($1,$2,$3,$4,$5)',[rows[0].recipe_id,ings[0].ingredient_id,quantity,unit,optional]);
   }
  }
  await client.query('INSERT INTO recipe_catalog_imports(version) VALUES($1)',[version]);
  await client.query('COMMIT');return true;
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
