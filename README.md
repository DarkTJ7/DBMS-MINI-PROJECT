# PantryChef — DBMS Mini Project

**PantryChef** is a recipe-discovery web application built with Next.js,
PostgreSQL and pgvector. Users enter ingredients they have, discover matching
recipes, see missing ingredients, and save or rate recipes.

**Team:** Tarun Jagan (Member 1) · Tanishk Gowda (Member 2)

<details>
<summary><strong>Project evaluation quick links</strong></summary>

- [Completed DBMS project report (PDF)](docs/reports/PantryChef_DBMS_Project_Report.pdf)
- [Viva guide](docs/VIVA-GUIDE.md)
- [Project design and requirements](docs/PROJECT.md)
- [DBMS rubric checklist](docs/RUBRIC-CHECKLIST.md)
- [Testing and validation history](docs/TESTING.md)
- [Recipe sources and provenance](docs/RECIPE-SOURCES.md)
- [Photo credits and licences](docs/PHOTO-CREDITS.md)
- [Query plans](docs/QUERY-PLANS.md) · [100K-row benchmark](docs/QUERY-PLANS-100K.md)

</details>

## Project at a glance

- **545 public recipes** in the documented 2 November 2026 catalogue snapshot,
  including 500 attributed Wikibooks imports and 45 other public dishes.
- Seven protein categories: chicken, fish, mutton, beef, lamb, prawns/shrimp
  and lobster. Category totals overlap for recipes containing multiple proteins.
- Pantry-based discovery requires at least **75% of required ingredients**.
  The **Ready to cook only** option requires a 100% required-ingredient match.
- Keyword search uses PostgreSQL full-text search; Meaning search uses
  128-dimensional TF-IDF/TruncatedSVD (LSA) vectors with pgvector cosine search.
- Recipe photographs are bundled locally and credited as illustrative serving
  suggestions, not guaranteed photographs of the exact cooked dish.
- Synthetic benchmark records are excluded from normal public meal discovery.

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js, React, CSS, Motion |
| Backend | Next.js Route Handlers / Node.js |
| Database | PostgreSQL 16 |
| Vector search | pgvector |
| Authentication | Hashed passwords, opaque sessions and restricted runtime DB role |
| Tests | Node.js test runner, PostgreSQL and API integration tests |

## Run the project

### Existing Windows setup

Requirements: Node.js 22+, Python 3.11+, WSL2 with an Ubuntu distribution,
and PostgreSQL 16 with pgvector configured as described in the project setup.

Open the repository folder in VS Code. In PowerShell run:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-app.ps1
```

Then open [http://127.0.0.1:3000](http://127.0.0.1:3000). Keep the terminal
running while using the app. Press Ctrl+C in that terminal to stop it.

### Fresh setup

Install PostgreSQL 16 and pgvector inside Ubuntu/WSL, then from the repository
root run:

```powershell
python -m pip install -r requirements.txt
npm.cmd install
npm.cmd run db:setup
npm.cmd run dev
```

The setup script creates the dedicated application database and runtime role,
restores the bundled seed into the new database, applies application and access
SQL, installs the recipe catalogues, and trains the local embedding model.
It generates private credentials in `.env.local`. **Never commit or share
`.env.local`, generated credentials, user data or `node_modules`.**

For native Linux, macOS, Docker or remote PostgreSQL instructions, see
[Project setup and architecture](docs/PROJECT.md). Remote setup has additional
database-role requirements; it is not a hosted deployment recipe.

## Suggested evaluation / demo flow

1. Start PantryChef and open the home page.
2. Add `mushroom, garlic, butter, pasta, cream` to the pantry.
3. Select **Find my next meal** and show that pantry results meet the 75%
   required-ingredient threshold.
4. Enable **Ready to cook only** to demonstrate a complete 100% match.
5. Open a recipe to show required and optional ingredients, missing items,
   instructions, source credits and photo attribution.
6. Register/sign in to demonstrate pantry persistence, saved recipes and ratings.
7. Demonstrate Keyword and Meaning search.
8. If admin access is configured, show recipe moderation/editing and the
   role-restricted admin functions.

## DBMS concepts demonstrated

- Relational schema, primary keys, foreign keys, composite keys and constraints.
- SQL DDL and DML, joins, filtering, aggregation and nested queries.
- PostgreSQL functions, procedures, triggers, views and transactions.
- Indexing, full-text search, pgvector and query-plan analysis.
- Database roles, least-privilege runtime access and row-level security.
- Application/database integration through parameterized queries.

See [the project report](docs/reports/PantryChef_DBMS_Project_Report.pdf),
[SQL demo queries](database/demo_queries.sql) and
[the rubric checklist](docs/RUBRIC-CHECKLIST.md) for evaluation details.

## Testing

With the database configured and a development or production server running,
execute the automated suite in another terminal:

```powershell
npm.cmd test
npm.cmd run build
node scripts/benchmark.mjs
```

The tests cover database permissions, authentication, pantry matching,
ingredient relevance, semantic/full-text search, catalogue imports, photo
assignments, saves, ratings and transaction behavior. The documented historical
run reached **18 passing tests and 0 failures** on 2 November 2026; see
[the validation record](docs/TESTING.md). This is a recorded result, not a
fresh test run performed by reading this README.

## Repository map

| Path | Purpose |
| --- | --- |
| `app/` | Frontend and API route handlers |
| `lib/` | Database access, authentication, security, search and recipe logic |
| `database/` | Schema, seed dump, application SQL, access controls and demo queries |
| `data/` | Recipe catalogue and local photo/source mappings |
| `scripts/` | Database setup, catalogue imports, embedding training and benchmarks |
| `tests/` | Automated database, API, search, photo and security tests |
| `docs/` | Project documentation, validation, screenshots and report |

## Data, matching and known limitations

The pantry percentage compares ingredient names in the structured required
ingredient list; it does not establish quantity sufficiency, substitutions,
expiry, nutrition or allergy safety. Optional ingredients do not reduce the
match percentage. Dietary filters are catalogue-based and are not certified
allergen or dietary guarantees.

Meaning search uses a local TF-IDF/TruncatedSVD model. It is a vocabulary-based
baseline, not a hosted large language model. The 100,000-row benchmark uses
labelled synthetic clones to measure query behavior; it does not represent
100,000 independently curated real recipes. Query-plan and timing results are
machine-specific observations, not production performance guarantees.

## Attribution and contribution

The project uses recipe sources and image assets with provenance and licence
details recorded in [RECIPE-SOURCES.md](docs/RECIPE-SOURCES.md) and
[PHOTO-CREDITS.md](docs/PHOTO-CREDITS.md). Development assistance from AI tools
is disclosed in the project materials; both team members should understand the
implementation and accurately describe their own contributions in the viva.
