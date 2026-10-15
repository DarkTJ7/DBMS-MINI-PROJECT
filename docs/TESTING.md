# Validation — 13 October 2026

## Automated checks

Production build (`npm run build` / equivalent pnpm invocation) passed. Next.js
compiled the frontend and dynamic Route Handler backend successfully.

`node --test tests/*.test.mjs`: **4 tests passed, 0 failed**. The integration test
contains multiple assertions over a real PostgreSQL database and running API:

| Scenario | Result |
| --- | --- |
| Ingredient-only mushroom search | Every result contains required mushroom |
| Chicken, rice, onion, garlic, tomato | One-Pot Tomato Chicken Rice reports 100% |
| Keyword search and empty result | Expected matches / zero results |
| Semantic search | Ranked positive cosine similarities |
| Registration forged with admin role | Still creates a regular user |
| Anonymous/admin-only access | 401 anonymous; 403 regular user |
| Cross-origin mutation | Rejected with 403 |
| Invalid ingredient IDs | Rejected, saved pantry remains consistent |
| Save/load/clear pantry | Persists and clears correctly |
| Submitted pending recipe | Hidden from visitor; readable by administrator |
| Admin approval | Becomes publicly visible and searchable |
| Save/unsave recipe | Cookbook membership follows changes |
| Ratings insert/update/delete | Aggregate average follows 5 → 2 → 0 |
| Logout | Revoked token no longer authorizes pantry access |
| Atomic recipe creation / invalid FK | Whole transaction rolls back |
| Password security | Salted digests differ; wrong and seed-placeholder passwords fail |
| Bounds/ID/origin validation | Invalid values rejected |

Temporary test users, recipes, pantries, sessions, saves, and ratings are cleaned
up. Tests use the local setup admin and do not touch the earlier terminal-demo
database. Reported counts exclude temporary test records.

## Browser checks

Entered `mushroom, garlic, butter, pasta, cream` through the actual frontend,
clicked Add and Find, and verified complete starter matches. Opened Creamy
Garlic Mushroom Pasta and verified ingredient quantities, optional flags,
instructions, Save, and rating controls. Desktop layout checked at 1280×900;
mobile layout at 390×844; responsive sidebar stacks below the hero on mobile.
Screenshots are in `screenshots/`. Auth/role/moderation persistence is tested
through the real HTTP API; not every form was separately exercised in the browser.

## Actual 100,000-row load test

Generated explicitly labeled synthetic recipe clones, producing **100,000
recipes and 699,991 recipe/ingredient links**. This simulates query load, not
100,000 independently curated real dishes. Rebuilt IVFFlat and refreshed planner
statistics. Preserved measured EXPLAIN ANALYZE/BUFFERS output in
`QUERY-PLANS-100K.md`. The clones were then removed; the runnable app returns to
906 recipes and the smaller default collection.

Representative single-run SQL execution times on this machine:

| Query | Measured execution | Observed index |
| --- | --- | --- |
| Full-text `chicken rice`, first 24 | 1.015 ms | GIN idx_recipes_search |
| Vector nearest 24 to existing anchor | 1.448 ms | IVFFlat idx_recipes_embedding |
| Ingredient 1 lookup | 19.786 ms | idx_recipe_ing_ingredient |
| Stored pantry match ranked top 24 | See complete plan | Ingredient candidate index + grouped aggregate |

Single HTTP requests, including API/database/JSON overhead: pantry search 0.929 s,
semantic search 0.806 s, keyword search 0.321 s. These are observations, not
statistical guarantees or production SLAs. The isolated vector example shows
index access; the combined API query may choose a different join/sort plan.
No forced optimizer switches were used to manufacture index selection.

## Remaining limitations / submission work

- Most demo recipes are synthetic; five starter recipes have coherent ingredient
  lists. No licensed real 100,000-recipe collection is bundled.
- Readiness checks names, not quantities, expiry, substitutions, or nutrition.
- Dietary rules use the catalogue, not comprehensive instruction/allergen parsing.
- LSA vocabulary limits synonym/general-language quality; no hosted model used.
- Password reset, verification email, shared rate limits, and deployment security
  configuration remain production enhancements.
- The named team and public source repository are in place. Instructor approval,
  genuine individual contributions and the final viva remain student responsibilities.

UI refinement: searching keeps programmatic focus on Meal results without drawing an outline around the section. Buttons retain visible keyboard focus. Recipe cards use larger text and a single column below 420px.

## Rubric completion validation - 15 October 2026

`node --test tests/*.test.mjs`: **5 tests passed, 0 failed** against the updated
local PostgreSQL database and running API. This includes a new direct-database
permission test and additional assertions in the API integration workflow.

| New scenario | Observed result |
| --- | --- |
| Direct runtime login privilege inspection | Non-owner runtime, not superuser, no BYPASSRLS |
| Read password hashes / session table | PostgreSQL 42501 permission denied |
| Promote own role / alter recipe table / SET ROLE owner | PostgreSQL 42501 permission denied |
| Read/write another user's pantry | Hidden / PostgreSQL 42501 |
| Read pending recipe as visitor or another user | Hidden |
| Approve/delete recipe as ordinary user using direct SQL | Zero affected rows |
| Approve recipe as admin using direct SQL | One affected row; visitors can then read it |
| Forged approved recipe insertion | PostgreSQL 42501 |
| Expired session reading pantry | No rows |
| Revoked admin session deleting recipe | Zero affected rows |
| Sixteen concurrent pooled contexts | Each resolves its own actor ID |
| PUT recipe as anonymous / regular user | HTTP 401 / 403 |
| Admin PUT title, instructions, ingredients | HTTP 200; replaces structured ingredients |
| Updated embedding | Changes; 128 dimensions; cosine distance to expected vector < 0.000001 |
| Updated full-text search | Edited recipe found by its new title |
| Invalid edited ingredient | HTTP 400; prior vector unchanged |
| Delete vector-bearing recipe with rating/save | Recipe, embedding and dependent rows absent; details 404; absent from semantic results |

Historical 100K plans above predate RLS and were measured using the maintenance
connection. They demonstrate index behavior, not post-RLS API latency guarantees.

Production build (`next build --webpack`) also passed. The final five-test run
against `next start` passed in about 2.54 seconds; raw output is in
`TEST-OUTPUT.txt`. Setup was rerun successfully to verify idempotence.

Browser evidence: a temporary admin recipe was created, edited to add garlic and
change title/instructions, saved successfully, and reopened with the persisted
values. The form was exercised at a narrow browser size and verified on the
production build at desktop size. `screenshots/admin-edit.png` captures the editor.
The temporary recipe was removed after verification; the collection remains 906.
