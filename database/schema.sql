-- =========================================================
-- PantryChef — Full Schema (DDL + Triggers + Stored Procs)
-- =========================================================
DROP TABLE IF EXISTS saved_recipes, ratings, user_pantry, recipe_ingredients, recipes, ingredients, users CASCADE;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(10) CHECK (role IN ('user','admin')) DEFAULT 'user',
  dietary_pref VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ingredients (
  ingredient_id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(50)
);

CREATE TABLE recipes (
  recipe_id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  cuisine VARCHAR(50),
  instructions TEXT NOT NULL,
  prep_time_min INT CHECK (prep_time_min > 0),
  difficulty VARCHAR(10) CHECK (difficulty IN ('Easy','Medium','Hard')),
  embedding VECTOR(128),
  avg_rating DECIMAL(3,2) DEFAULT 0,
  created_by INT REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE recipe_ingredients (
  recipe_id INT REFERENCES recipes(recipe_id) ON DELETE CASCADE,
  ingredient_id INT REFERENCES ingredients(ingredient_id) ON DELETE CASCADE,
  quantity DECIMAL(6,2) CHECK (quantity >= 0),
  unit VARCHAR(20),
  is_optional BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (recipe_id, ingredient_id)
);

CREATE TABLE user_pantry (
  user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
  ingredient_id INT REFERENCES ingredients(ingredient_id) ON DELETE CASCADE,
  quantity DECIMAL(6,2),
  added_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, ingredient_id)
);

CREATE TABLE ratings (
  rating_id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
  recipe_id INT REFERENCES recipes(recipe_id) ON DELETE CASCADE,
  stars INT CHECK (stars BETWEEN 1 AND 5),
  review_text TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, recipe_id)
);

CREATE TABLE saved_recipes (
  user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
  recipe_id INT REFERENCES recipes(recipe_id) ON DELETE CASCADE,
  saved_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, recipe_id)
);

-- =========================================================
-- Indexes
-- =========================================================
CREATE INDEX idx_recipes_embedding ON recipes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX idx_recipe_ing_ingredient ON recipe_ingredients(ingredient_id);
CREATE INDEX idx_pantry_ingredient ON user_pantry(ingredient_id);
CREATE INDEX idx_ratings_recipe ON ratings(recipe_id);
CREATE INDEX idx_recipes_cuisine ON recipes(cuisine);

-- =========================================================
-- Trigger: auto-recompute avg_rating on INSERT/UPDATE/DELETE of ratings
-- =========================================================
CREATE OR REPLACE FUNCTION fn_update_avg_rating() RETURNS TRIGGER AS $$
BEGIN
  UPDATE recipes
  SET avg_rating = COALESCE((
    SELECT ROUND(AVG(stars)::numeric, 2) FROM ratings
    WHERE recipe_id = COALESCE(NEW.recipe_id, OLD.recipe_id)
  ), 0)
  WHERE recipe_id = COALESCE(NEW.recipe_id, OLD.recipe_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_avg_rating
AFTER INSERT OR UPDATE OR DELETE ON ratings
FOR EACH ROW EXECUTE FUNCTION fn_update_avg_rating();

-- =========================================================
-- Stored Procedure / Function: pantry match ranking
-- =========================================================
CREATE OR REPLACE FUNCTION get_pantry_match(p_user_id INT)
RETURNS TABLE(recipe_id INT, title VARCHAR, total_needed BIGINT, matched BIGINT, match_pct NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT r.recipe_id, r.title,
         COUNT(ri.ingredient_id) AS total_needed,
         COUNT(up.ingredient_id) AS matched,
         ROUND(100.0 * COUNT(up.ingredient_id) / COUNT(ri.ingredient_id), 1) AS match_pct
  FROM recipes r
  JOIN recipe_ingredients ri ON ri.recipe_id = r.recipe_id
  LEFT JOIN user_pantry up ON up.ingredient_id = ri.ingredient_id AND up.user_id = p_user_id
  GROUP BY r.recipe_id, r.title
  HAVING COUNT(up.ingredient_id) > 0
  ORDER BY match_pct DESC, matched DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- Transaction-safe recipe insert procedure (recipe + ingredients atomically)
-- =========================================================
CREATE OR REPLACE PROCEDURE add_recipe_with_ingredients(
  p_title VARCHAR, p_cuisine VARCHAR, p_instructions TEXT, p_prep INT,
  p_difficulty VARCHAR, p_created_by INT,
  p_ingredient_ids INT[], p_quantities NUMERIC[], p_units VARCHAR[]
) AS $$
DECLARE
  v_recipe_id INT;
  i INT;
BEGIN
  INSERT INTO recipes(title, cuisine, instructions, prep_time_min, difficulty, created_by)
  VALUES (p_title, p_cuisine, p_instructions, p_prep, p_difficulty, p_created_by)
  RETURNING recipe_id INTO v_recipe_id;

  FOR i IN 1 .. array_length(p_ingredient_ids, 1) LOOP
    INSERT INTO recipe_ingredients(recipe_id, ingredient_id, quantity, unit)
    VALUES (v_recipe_id, p_ingredient_ids[i], p_quantities[i], p_units[i]);
  END LOOP;

  COMMIT;
END;
$$ LANGUAGE plpgsql;
