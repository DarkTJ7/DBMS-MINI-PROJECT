-- Idempotent application-level integrity additions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(lower(email));
ALTER TABLE users ALTER COLUMN role SET NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='recipes_nonempty_text') THEN
  ALTER TABLE recipes ADD CONSTRAINT recipes_nonempty_text CHECK(length(trim(title))>=3 AND length(trim(instructions))>=20);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='ingredient_quantity_positive') THEN
  ALTER TABLE recipe_ingredients ADD CONSTRAINT ingredient_quantity_positive CHECK(quantity>0);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='session_token_is_digest') THEN
  ALTER TABLE app_sessions ADD CONSTRAINT session_token_is_digest CHECK(token_hash ~ '^[a-f0-9]{64}$');
 END IF;
END $$;
