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

## Real food photograph validation - 1 November 2026

Replaced CSS bowl illustrations with 31 locally hosted Commons photos, matched
by title words with representative serving-suggestion labels. All seven automated
tests passed (zero failures), including the two new matching/asset/credit checks;
raw output is in PHOTO-TEST-OUTPUT.txt. Earlier API, RLS and transaction tests also
passed. The first API test attempt ran after the development server had stopped
for its existing Next.js security reminder; it passed after the server restart.
The known Next.js advisory remains a separate maintenance item.

The browser verified all first five starter-result photos loaded from local paths,
and confirmed photo source/license links in the detail modal. These are food
illustrations, not exact photography of all 906 synthetic/starter recipes.

Production build passed after retrying the existing Next.js advisory reminder.
The production API returned HTTP 200 and all 31 photo assets returned HTTP 200.
Desktop starter cards loaded their expected images. A 390px-wide mobile check
showed a single card column, no horizontal overflow and successfully loaded visible
photos. Evidence: screenshots/real-food-photos.png and real-food-mobile.png.

## Duplicate photo regression validation - 1 November 2026

Replaced shared ingredient-only images for existing records with 906 stable,
distinct photo assignments. Expanded the local collection to 927 credited assets.
Downloaded candidates were screened using Commons file categories, visual review,
exact hashes and a conservative perceptual-hash comparison. Published images were
optimized for display, retaining their original source/license credits.

`node --test tests/*.test.mjs`: **9 passed, 0 failed**. The new tests check every
existing recipe's image path, Commons source and actual image bytes for duplicates,
plus the Mediterranean Chicken Breast Soup / Mexican Chicken Breast Pilaf /
American Chicken Breast Pilaf regression and stale-photo protection after edits.
Raw output is in `PHOTO-DEDUP-TEST-OUTPUT.txt`.

New/renamed submissions require an explicit assignment to join the existing
catalogue's uniqueness guarantee. Their representative fallback can reuse an image.
These images are serving suggestions and may differ from synthetic recipes.

Production build passed after the existing advisory reminder was acknowledged by
retrying the same build. In the browser, a quoted OR search for the three reported
titles returned five matching records (some titles occur more than once). All five
used different loaded image URLs. The soup detail retained the same photo as its
card and linked the correct Commons source. Evidence: screenshots/distinct-chicken-recipes.png.

## Warm palette and smoother interactions (2026-11-01)

- Replaced the green theme with warm ivory, charcoal and terracotta.
- Added shared Motion timing tokens, gentle recipe-dialog entry/exit, staggered card entry, pantry chip feedback and notification transitions.
- Existing results remain visible and disabled while replacements load. Initial loading uses static placeholders with reserved image dimensions.
- MotionConfig and useReducedMotion honor reduced-motion preferences; transforms are also suppressed by CSS. Low-core devices skip nonessential transforms. Server-rendered content starts visible.
- Verified in the browser: mushroom keyword search returns meals; current cards remain during the request; recipe detail opens, locks body scrolling, focuses Close, and Escape dismisses it and restores focus to its recipe card.
- Verified a 390 × 844 phone viewport: no horizontal page overflow. Reset viewport after checking.
- All nine existing database/API/photo/security tests passed. Production build passed.
- No browser console errors or warnings during the interaction checks. Reduced-motion support was reviewed in code; OS accessibility settings were not changed.
- Preview: `docs/screenshots/warm-palette-desktop.png`.

## Ingredient relevance and Indian catalogue (2026-11-02)

- All 13 tests pass; raw output is in `SEARCH-RELEVANCE-TEST-OUTPUT.txt`.
- New regression tests assert actual required fish/chicken links in both search modes, distinguish fish from fish sauce, check exclusions, and check that vegetarian + fish has no results.
- All 40 additions are present once with matching quantities, units and recipe-specific steps. Repeated setup retains the same catalogue rows.
- Synthetic rows are excluded from discovery without deleting benchmark data; saved legacy recipes can still be opened.
- Every new recipe has a distinct local image path and SHA-256 content hash, stable between cards and details. All assets retain author/source/license credits.
- Browser: searching fish in Keyword returns exactly ten fish recipes; Meaning mode also returns fish dishes. Photos remain illustrative serving suggestions.
- Home recipes are independently written variants, not externally imported/copyrighted instructions or claims of kitchen testing. Cooking-temperature checks use https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures. General ingredient/method references: https://www.indianhealthyrecipes.com/fish-curry-recipe/ and https://www.indianhealthyrecipes.com/chicken-curry/.
- Production build passed; production browser check returned ten fish recipes in Meaning mode, each with a distinct image. Indian Fish Masala Curry showed its required fish quantity and five cooking steps. Screenshot: `docs/screenshots/accurate-fish-search.png`.

## Seven proteins and 500 source recipes (2026-11-02)

- 500 imported records have unique source URLs, titles, and normalized cooking-method hashes; all original ingredient lines and methods match the bundled source snapshot.
- 521 distinct approved, non-synthetic recipes contain at least one of the seven supported proteins. The full public collection has 545 dishes. Counts overlap for mixed-meat recipes: chicken 208, fish 130, mutton 7, beef 155, lamb 13, prawn/shrimp 40, lobster 4.
- All 16 tests passed. Raw output: `EXPANDED-MEAT-CATALOG-TEST-OUTPUT.txt`. Tests cover every page of each protein filter, Keyword/Meaning ingredient requirements, vegetarian exclusion, duplicate prevention, idempotent import, provenance preservation, and existing role/security behavior.
- Browser verified the seven filter counts, mutton results, and lobster detail. Jerk Lobster displayed six original ingredient lines, its full method, servings, source/history links and CC BY-SA license. Missing time and photo values were labeled honestly.
- Search performance: an EXPLAIN ANALYZE sample spent 10,991.739 ms in LLVM JIT out of 11,266.099 ms total. Recipe lookups now set `jit=off` only within that search transaction. Local development API checks afterwards: lobster 84 ms, mutton 24 ms, beef 34 ms. These are observations on this machine, not performance guarantees.
- No change to row-level security or session derivation. Existing database-role tests passed after the query optimization.
- Final production build passed. Production menu showed all seven category counts and 545 public dishes; mutton filter returned seven source-backed recipes. Final snapshot version is `seven-proteins-500-v2`; withdrawn imports are retained with rejected status rather than deleting their saved/review data. Preview: `docs/screenshots/expanded-protein-collection.png`.


## Photos for the expanded collection (2026-11-02)

- All 500 imported recipes now resolve to a locally bundled photo. Together with the original 45 public dishes, all 545 public recipes have different image paths, Commons source URLs and SHA-256 file hashes.
- Card and detail lookup share a stable source-key/title mapping. An edited title or unknown source key falls back to the labeled placeholder rather than inheriting an unrelated assignment.
- Photos are illustrative serving suggestions. The pictured ingredients, preparation and presentation may differ from the linked recipe; they are not photographs of tested results for each imported recipe. This label appears on cards and source/author/license credit appears in details.
- Commons candidates were screened using descriptions/categories and visual contact sheets. The selected new downloads were checked for valid dimensions and exact duplicates. The local assets are resized/compressed JPEG files, so the app does not depend on live image-search URLs.
- All 17 automated tests passed, including the 545-recipe coverage/uniqueness regression and existing database, role, search and security tests. Raw output: `SOURCE-PHOTO-TEST-OUTPUT.txt`.
- Production build passed. All 500 new image URLs returned HTTP 200 with JPEG content type. Browser verification showed four loaded, distinct lobster card images; Jerk Lobster detail used the identical card image with its author/license link. Evidence: `screenshots/expanded-recipe-photos.png` and `screenshots/expanded-recipe-photo-detail.png`.
