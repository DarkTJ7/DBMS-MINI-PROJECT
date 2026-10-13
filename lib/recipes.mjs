import {cookingGuide} from './cooking-guide.mjs';
import {sql} from './db.mjs';
import {embed} from './embeddings.mjs';
import {ApiError} from './security.mjs';
export async function findRecipes({ingredientIds=[],q='',cuisine='',diet='',ready=false,mode='pantry',page=1,savedUser=null}) {
 if(!['pantry','text','semantic'].includes(mode))throw new ApiError('Invalid search mode.');
 if(!['','vegetarian','vegan'].includes(diet))throw new ApiError('Invalid dietary filter.');
 let vector=null;
 if(mode==='semantic'&&q){vector=embed(q);if(!vector)throw new ApiError('No vocabulary match. Try words like creamy pasta, spicy chicken, or mushroom.');}
 const values=[ingredientIds,q,cuisine,diet,ready,vector,savedUser,24,(page-1)*24];
 const words=mode==='text'&&q;
 const semantics=mode==='semantic'&&vector;
 const where=`r.status='approved' AND ($3='' OR r.cuisine=$3)
 AND (NOT $5::boolean OR (m.required=m.matched AND m.required>0))
 AND ($7::integer IS NULL OR EXISTS(SELECT 1 FROM saved_recipes s WHERE s.recipe_id=r.recipe_id AND s.user_id=$7))
 AND ($4='' OR NOT EXISTS(SELECT 1 FROM recipe_ingredients dx JOIN ingredients ix USING(ingredient_id)
 WHERE dx.recipe_id=r.recipe_id AND NOT dx.is_optional AND (
 ix.name=ANY(ARRAY['chicken breast','ground beef','shrimp','salmon','pork loin','lamb','turkey','bacon','tuna','fish sauce','stock'])
 OR ($4='vegan' AND ix.name=ANY(ARRAY['eggs','milk','butter','cheese','cream','yogurt','paneer','ghee','honey','mayonnaise'])))))
 ${words?"AND r.search_document @@ websearch_to_tsquery('english',$2)":''}
 ${semantics?'AND r.embedding IS NOT NULL':''}`;
 const order=semantics?'r.embedding <=> $6::vector':words?"ts_rank(r.search_document,websearch_to_tsquery('english',$2)) DESC, m.match_pct DESC NULLS LAST":'m.match_pct DESC NULLS LAST, cardinality(m.missing_ids), r.avg_rating DESC';
 // Explicit parameter casts make the parameter types stable across search modes.
 const rows=await sql(`WITH params AS (SELECT $2::text AS q,$6::text AS vec),
 matched AS (SELECT * FROM pantry_match($1::integer[]))
 SELECT r.recipe_id,r.title,r.cuisine,r.prep_time_min,r.difficulty,r.avg_rating,r.is_sample,
 m.required,m.matched,m.match_pct,
 (SELECT coalesce(json_agg(i.name ORDER BY i.name),'[]') FROM ingredients i WHERE i.ingredient_id=ANY(m.missing_ids)) AS missing,
 ${semantics?'round((1-(r.embedding <=> $6::vector))::numeric,3)':'NULL::numeric'} AS similarity,
 count(*) OVER() AS total
 FROM recipes r JOIN matched m USING(recipe_id) CROSS JOIN params
 WHERE ${where} ORDER BY ${order},r.recipe_id LIMIT $8 OFFSET $9`,values);
 return {recipes:rows,total:Number(rows[0]?.total||0),page};
}
export async function recipeDetail(id,userId,admin=false) {
 const [recipe]=await sql(`SELECT r.*, (SELECT count(*) FROM ratings rt WHERE rt.recipe_id=r.recipe_id) AS rating_count
 FROM recipes r WHERE recipe_id=$1 AND (status='approved' OR created_by=$2 OR $3::boolean)`,[id,userId||null,admin]);
 if(!recipe)throw new ApiError('Recipe not found.',404);
 delete recipe.embedding;delete recipe.search_document;
 recipe.ingredients=await sql(`SELECT i.ingredient_id,i.name,ri.quantity,ri.unit,ri.is_optional FROM recipe_ingredients ri JOIN ingredients i USING(ingredient_id) WHERE recipe_id=$1 ORDER BY ri.is_optional,i.name`,[id]);
 recipe.cooking_guide=cookingGuide(recipe);
 recipe.reviews=await sql(`SELECT rt.stars,rt.review_text,u.name FROM ratings rt JOIN users u USING(user_id) WHERE recipe_id=$1 ORDER BY rt.created_at DESC LIMIT 12`,[id]);
 if(userId){recipe.saved=!!(await sql('SELECT 1 FROM saved_recipes WHERE user_id=$1 AND recipe_id=$2',[userId,id])).length;
  recipe.my_rating=(await sql('SELECT stars,review_text FROM ratings WHERE user_id=$1 AND recipe_id=$2',[userId,id]))[0]||null;}
 return recipe;
}
