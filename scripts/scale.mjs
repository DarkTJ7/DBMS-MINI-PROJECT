import nextEnv from '@next/env';
import pg from 'pg';
import {keepDatabaseAlive} from './wsl.mjs';
nextEnv.loadEnvConfig(process.cwd());
const alive=keepDatabaseAlive(),pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const target=Number(process.argv[2]||100000);
if(!Number.isInteger(target)||target<1000||target>200000)throw new Error('Choose a total between 1000 and 200000.');
try {
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const {rows}=await client.query('SELECT count(*)::int AS count FROM recipes');
  const extra=Math.max(0,target-rows[0].count);
  if(extra) {
   // Synthetic clones for query-load demonstrations, not additional real recipes.
   await client.query(`CREATE TEMP TABLE seed_ids ON COMMIT DROP AS SELECT recipe_id,row_number() OVER(ORDER BY recipe_id)::int AS n
    FROM recipes WHERE embedding IS NOT NULL AND is_sample AND title NOT LIKE '% [load %' LIMIT 900`);
   const seedCount=(await client.query('SELECT count(*)::int AS n FROM seed_ids')).rows[0].n;
   for(let offset=0;offset<extra;offset+=1000) {
    const batch=Math.min(1000,extra-offset);
    await client.query(`CREATE TEMP TABLE copies ON COMMIT DROP AS SELECT nextval('recipes_recipe_id_seq')::int AS new_id,
      s.recipe_id AS source_id,g AS serial FROM generate_series($1::int,$2::int) g JOIN seed_ids s ON s.n=1+(g % $3::int)`,[offset,offset+batch-1,seedCount]);
    await client.query(`INSERT INTO recipes(recipe_id,title,cuisine,instructions,prep_time_min,difficulty,embedding,created_by,status,is_sample)
      SELECT c.new_id,left(r.title,165)||' [load '||c.new_id||']',r.cuisine,r.instructions,r.prep_time_min,r.difficulty,r.embedding,r.created_by,'approved',true
      FROM copies c JOIN recipes r ON r.recipe_id=c.source_id`);
    await client.query(`INSERT INTO recipe_ingredients(recipe_id,ingredient_id,quantity,unit,is_optional)
      SELECT c.new_id,ri.ingredient_id,ri.quantity,ri.unit,ri.is_optional FROM copies c JOIN recipe_ingredients ri ON ri.recipe_id=c.source_id`);
    await client.query('DROP TABLE copies');
    if(offset%10000===0)console.log('Inserted',offset+batch,'synthetic load-test rows.');
   }
  }
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 await pool.query('REINDEX INDEX idx_recipes_embedding');await pool.query('ANALYZE');
 console.log('Recipe total:',(await pool.query('SELECT count(*) FROM recipes')).rows[0].count);
}finally{await pool.end();alive?.kill();}
