-- Run as the schema owner. The runtime login is provisioned separately by setup.
BEGIN;
CREATE OR REPLACE FUNCTION app_actor_id() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT s.user_id FROM public.app_sessions s
 WHERE s.token_hash=nullif(current_setting('pantrychef.session_hash',true),'')
 AND s.expires_at>now()
$$;
CREATE OR REPLACE FUNCTION app_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT coalesce((SELECT u.role='admin' FROM public.users u
 WHERE u.user_id=public.app_actor_id()),false)
$$;
REVOKE ALL ON FUNCTION app_actor_id(),app_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_actor_id(),app_is_admin() TO pantrychef_runtime;

-- Views expose only public author names / aggregated counts, never credentials.
CREATE OR REPLACE VIEW public_profiles AS SELECT user_id,name FROM users;
CREATE OR REPLACE VIEW public_counts AS SELECT count(*) AS cooks FROM users;
-- A default owner-rights view would bypass recipe visibility policies.
ALTER VIEW cuisine_summary SET (security_invoker=true);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_pantry ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_read ON users;
CREATE POLICY users_read ON users FOR SELECT TO pantrychef_runtime
 USING(user_id=app_actor_id() OR app_is_admin());
DROP POLICY IF EXISTS recipe_read ON recipes;
CREATE POLICY recipe_read ON recipes FOR SELECT TO pantrychef_runtime
 USING(status='approved' OR created_by=app_actor_id() OR app_is_admin());
DROP POLICY IF EXISTS recipe_create ON recipes;
CREATE POLICY recipe_create ON recipes FOR INSERT TO pantrychef_runtime
 WITH CHECK(created_by=app_actor_id() AND (status='pending' OR app_is_admin()));
DROP POLICY IF EXISTS recipe_update ON recipes;
CREATE POLICY recipe_update ON recipes FOR UPDATE TO pantrychef_runtime
 USING(app_is_admin()) WITH CHECK(app_is_admin());
DROP POLICY IF EXISTS recipe_delete ON recipes;
CREATE POLICY recipe_delete ON recipes FOR DELETE TO pantrychef_runtime USING(app_is_admin());
DROP POLICY IF EXISTS links_read ON recipe_ingredients;
CREATE POLICY links_read ON recipe_ingredients FOR SELECT TO pantrychef_runtime
 USING(EXISTS(SELECT 1 FROM recipes r WHERE r.recipe_id=recipe_ingredients.recipe_id));
DROP POLICY IF EXISTS links_create ON recipe_ingredients;
CREATE POLICY links_create ON recipe_ingredients FOR INSERT TO pantrychef_runtime
 WITH CHECK(EXISTS(SELECT 1 FROM recipes r WHERE r.recipe_id=recipe_ingredients.recipe_id
 AND (app_is_admin() OR (r.created_by=app_actor_id() AND r.status='pending'))));
DROP POLICY IF EXISTS links_update ON recipe_ingredients;
CREATE POLICY links_update ON recipe_ingredients FOR UPDATE TO pantrychef_runtime
 USING(app_is_admin()) WITH CHECK(app_is_admin());
DROP POLICY IF EXISTS links_delete ON recipe_ingredients;
CREATE POLICY links_delete ON recipe_ingredients FOR DELETE TO pantrychef_runtime USING(app_is_admin());
DROP POLICY IF EXISTS pantry_owner ON user_pantry;
CREATE POLICY pantry_owner ON user_pantry FOR ALL TO pantrychef_runtime
 USING(user_id=app_actor_id()) WITH CHECK(user_id=app_actor_id());
DROP POLICY IF EXISTS saves_owner ON saved_recipes;
CREATE POLICY saves_owner ON saved_recipes FOR ALL TO pantrychef_runtime
 USING(user_id=app_actor_id()) WITH CHECK(user_id=app_actor_id());
DROP POLICY IF EXISTS ratings_read ON ratings;
CREATE POLICY ratings_read ON ratings FOR SELECT TO pantrychef_runtime
 USING(EXISTS(SELECT 1 FROM recipes r WHERE r.recipe_id=ratings.recipe_id));
DROP POLICY IF EXISTS ratings_create ON ratings;
CREATE POLICY ratings_create ON ratings FOR INSERT TO pantrychef_runtime
 WITH CHECK(user_id=app_actor_id() AND EXISTS(SELECT 1 FROM recipes r
 WHERE r.recipe_id=ratings.recipe_id AND r.status='approved'));
DROP POLICY IF EXISTS ratings_update ON ratings;
CREATE POLICY ratings_update ON ratings FOR UPDATE TO pantrychef_runtime
 USING(user_id=app_actor_id()) WITH CHECK(user_id=app_actor_id() AND EXISTS(SELECT 1 FROM recipes r WHERE r.recipe_id=ratings.recipe_id AND r.status='approved'));
DROP POLICY IF EXISTS ratings_delete ON ratings;
CREATE POLICY ratings_delete ON ratings FOR DELETE TO pantrychef_runtime USING(user_id=app_actor_id());

-- Rating maintenance is a narrow trusted operation, not general recipe access.
ALTER FUNCTION fn_update_avg_rating() SECURITY DEFINER;
ALTER FUNCTION fn_update_avg_rating() SET search_path=pg_catalog,public,pg_temp;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM pantrychef_runtime;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM pantrychef_runtime;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM pantrychef_runtime;
-- PostgreSQL functions default to PUBLIC execute; remove that on app entry points.
REVOKE ALL ON FUNCTION fn_update_avg_rating(),get_pantry_match(integer),pantry_match(integer[]) FROM PUBLIC;
REVOKE ALL ON PROCEDURE add_recipe_with_ingredients(varchar,varchar,text,integer,varchar,integer,integer[],numeric[],varchar[]) FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO pantrychef_runtime;
GRANT SELECT ON ingredients,public_profiles,public_counts,cuisine_summary TO pantrychef_runtime;
GRANT SELECT(user_id,name,email,role) ON users TO pantrychef_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON recipes,recipe_ingredients,user_pantry,ratings,saved_recipes TO pantrychef_runtime;
GRANT USAGE,SELECT ON SEQUENCE recipes_recipe_id_seq,ratings_rating_id_seq TO pantrychef_runtime;
GRANT EXECUTE ON FUNCTION app_actor_id(),app_is_admin(),pantry_match(integer[]) TO pantrychef_runtime;
COMMIT;
