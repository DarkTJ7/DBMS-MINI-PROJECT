import nextEnv from '@next/env';
import pg from 'pg';
import {keepDatabaseAlive} from './wsl.mjs';
nextEnv.loadEnvConfig(process.cwd());
const alive=keepDatabaseAlive(),pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try{
 // Only the explicitly labeled synthetic clones made by scale.mjs.
 const result=await pool.query("DELETE FROM recipes WHERE is_sample AND title ~ '\\[load [0-9]+\\]$'");
 await pool.query('VACUUM (ANALYZE) recipes, recipe_ingredients');
 await pool.query('REINDEX INDEX idx_recipes_embedding');
 console.log('Removed',result.rowCount,'synthetic load-test clones.');
}finally{await pool.end();alive?.kill();}
