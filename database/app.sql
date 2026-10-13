BEGIN;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS status varchar(10) NOT NULL DEFAULT 'approved'
 CHECK (status IN ('approved','pending','rejected'));
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT true;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS search_document tsvector GENERATED ALWAYS AS (
 setweight(to_tsvector('english',coalesce(title,'')), 'A') ||
 setweight(to_tsvector('english',coalesce(instructions,'')), 'B')) STORED;
CREATE INDEX IF NOT EXISTS idx_recipes_search ON recipes USING gin(search_document);
CREATE INDEX IF NOT EXISTS idx_recipes_status ON recipes(status);
ALTER TABLE ratings ALTER COLUMN stars SET NOT NULL;
ALTER TABLE recipe_ingredients ALTER COLUMN is_optional SET NOT NULL;
ALTER TABLE user_pantry ADD CONSTRAINT pantry_quantity_positive CHECK (quantity > 0);
CREATE TABLE IF NOT EXISTS app_sessions (
 token_hash text PRIMARY KEY,
 user_id integer NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON app_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON app_sessions(expires_at);
CREATE OR REPLACE VIEW cuisine_summary AS
 SELECT cuisine, count(*) AS recipe_count, round(avg(avg_rating),2) AS average_rating
 FROM recipes WHERE status='approved' GROUP BY cuisine;
CREATE OR REPLACE FUNCTION pantry_match(p_ingredients integer[])
RETURNS TABLE(recipe_id integer, required bigint, matched bigint, missing_ids integer[], match_pct numeric)
LANGUAGE sql STABLE AS $$
 SELECT ri.recipe_id,
 count(*) FILTER (WHERE NOT ri.is_optional),
 count(*) FILTER (WHERE NOT ri.is_optional AND ri.ingredient_id=ANY(p_ingredients)),
 coalesce(array_agg(ri.ingredient_id ORDER BY ri.ingredient_id) FILTER
   (WHERE NOT ri.is_optional AND NOT (ri.ingredient_id=ANY(p_ingredients))), '{}'::integer[]),
 round(100.0 * count(*) FILTER (WHERE NOT ri.is_optional AND ri.ingredient_id=ANY(p_ingredients)) /
   nullif(count(*) FILTER (WHERE NOT ri.is_optional),0),1)
 FROM recipe_ingredients ri
 WHERE cardinality(p_ingredients)=0 OR ri.recipe_id IN (
   SELECT x.recipe_id FROM recipe_ingredients x WHERE x.ingredient_id=ANY(p_ingredients) AND NOT x.is_optional)
 GROUP BY ri.recipe_id;
$$;
-- Recompute both recipes if an existing rating is moved between recipes.
CREATE OR REPLACE FUNCTION fn_update_avg_rating() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'DELETE' THEN
  UPDATE recipes SET avg_rating=coalesce((SELECT round(avg(stars)::numeric,2)
  FROM ratings WHERE recipe_id=NEW.recipe_id),0) WHERE recipe_id=NEW.recipe_id;
 END IF;
 IF TG_OP='DELETE' OR (TG_OP='UPDATE' AND OLD.recipe_id IS DISTINCT FROM NEW.recipe_id) THEN
  UPDATE recipes SET avg_rating=coalesce((SELECT round(avg(stars)::numeric,2)
  FROM ratings WHERE recipe_id=OLD.recipe_id),0) WHERE recipe_id=OLD.recipe_id;
 END IF;
 RETURN NULL;
END; $$;
COMMIT;
