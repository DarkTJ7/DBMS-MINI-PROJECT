-- =========================================================
-- PantryChef — Demo Queries
-- Run after schema.sql + generate_data.py have populated the DB.
-- Each block demonstrates one required feature.
-- =========================================================

-- 1. Row counts (sanity check on the fake dataset)
SELECT 'users' t, COUNT(*) FROM users UNION ALL
SELECT 'ingredients', COUNT(*) FROM ingredients UNION ALL
SELECT 'recipes', COUNT(*) FROM recipes UNION ALL
SELECT 'recipe_ingredients', COUNT(*) FROM recipe_ingredients UNION ALL
SELECT 'user_pantry', COUNT(*) FROM user_pantry UNION ALL
SELECT 'ratings', COUNT(*) FROM ratings UNION ALL
SELECT 'saved_recipes', COUNT(*) FROM saved_recipes;

-- 2. Ingredient-match search: what can user 1 cook right now?
--    (JOIN + LEFT JOIN + GROUP BY + HAVING)
SELECT r.recipe_id, r.title,
       COUNT(ri.ingredient_id) AS total_needed,
       COUNT(up.ingredient_id) AS matched,
       ROUND(100.0 * COUNT(up.ingredient_id) / COUNT(ri.ingredient_id), 1) AS match_pct
FROM recipes r
JOIN recipe_ingredients ri ON ri.recipe_id = r.recipe_id
LEFT JOIN user_pantry up ON up.ingredient_id = ri.ingredient_id AND up.user_id = 1
GROUP BY r.recipe_id, r.title
HAVING COUNT(up.ingredient_id) > 0
ORDER BY match_pct DESC
LIMIT 10;

-- 3. Same thing via the stored function (equivalent result, reusable API)
SELECT * FROM get_pantry_match(1) LIMIT 10;

-- 4. Semantic search: find recipes similar in *meaning* to a given recipe,
--    using the pgvector cosine-distance operator (<=>) over TF-IDF/SVD embeddings.
WITH anchor AS (SELECT embedding FROM recipes WHERE title ILIKE '%Thai%Shrimp%' LIMIT 1)
SELECT r.recipe_id, r.title, r.cuisine,
       ROUND((1 - (r.embedding <=> a.embedding))::numeric, 4) AS similarity
FROM recipes r, anchor a
ORDER BY r.embedding <=> a.embedding
LIMIT 10;

-- 5. Confirm the IVFFlat vector index is actually used (not a sequential scan)
EXPLAIN SELECT recipe_id, title FROM recipes
ORDER BY embedding <=> (SELECT embedding FROM recipes LIMIT 1)
LIMIT 5;

-- 6. Trigger proof: avg_rating recalculates automatically on new rating
SELECT recipe_id, title, avg_rating FROM recipes WHERE recipe_id = 1;
INSERT INTO ratings (user_id, recipe_id, stars, review_text)
VALUES (2, 1, 5, 'Trigger demo review')
ON CONFLICT (user_id, recipe_id) DO UPDATE SET stars = 5;
SELECT recipe_id, title, avg_rating FROM recipes WHERE recipe_id = 1;  -- value has changed

-- 7. Transaction-safe recipe creation (recipe + all its ingredients, atomically)
CALL add_recipe_with_ingredients(
  'Demo Recipe', 'American', 'Demo instructions for a transaction-safe insert.',
  20, 'Easy', 1,
  ARRAY[1,2,3]::int[], ARRAY[1,1,1]::numeric[], ARRAY['cup','cup','cup']::varchar[]
);

-- 8. Top-rated recipes overall
SELECT title, cuisine, avg_rating,
       (SELECT COUNT(*) FROM ratings WHERE ratings.recipe_id = recipes.recipe_id) AS num_ratings
FROM recipes
WHERE avg_rating > 0
ORDER BY avg_rating DESC, num_ratings DESC
LIMIT 10;

-- 9. Cuisine-level summary
SELECT cuisine, COUNT(*) AS recipes, ROUND(AVG(avg_rating),2) AS avg_rating
FROM recipes GROUP BY cuisine ORDER BY recipes DESC;

-- 10. Admin role check example (role-based authorization at the data layer)
SELECT user_id, name, role FROM users WHERE role = 'admin';
