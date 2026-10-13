# DBMS MINI PROJECT — PantryChef

**Team:** Tarun Jagan (Member 1), Tanishk Gowda (Member 2).


A Next.js frontend and backend backed by PostgreSQL and pgvector. Enter pantry
ingredients, find matching dishes, inspect missing ingredients, and save recipes.
This implementation follows the supplied DBMS Level 3 project requirements.

## On Tarun's machine

Open **this folder**, not a ZIP file, in VS Code. In its PowerShell terminal run:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-app.ps1
```

Open **http://127.0.0.1:3000**. Keep the terminal running; Ctrl+C stops the app.
If another copy is already running, use the URL it prints or stop the earlier
terminal before starting again. The server automatically starts and keeps Ubuntu
WSL's PostgreSQL alive. The existing terminal-demo database is not changed.

1. Enter `mushroom, garlic, butter, pasta, cream` in **Add your ingredients**.
2. Click **+**, then **Find my next meal**.
3. Open Creamy Garlic Mushroom Pasta. Required ingredients show green checks;
   missing optional ingredients do not prevent a 100% match.
4. Create a regular account to save your pantry, rate dishes, and use My cookbook.
5. Search by **Keyword** for full-text results, or **Meaning** for vector similarity.

The admin account is created during setup. Its email and generated setup password
are in your **private `.env.local`** file. Use them to sign in and open **Admin**.
Seed users have unusable placeholder hashes; they cannot log in.

## Friend's computer / fresh Windows setup

Requirements: Node.js **22 or later** (with npm), Python **3.11 or later**, and
WSL2 with an Ubuntu distro named **Ubuntu**. The ZIP contains source and seed
data, not installed software or your database service. Internet is needed to
install packages. The app itself and its database run locally.

1. Extract `PantryChef-App.zip`, open the **PantryChef-App** folder in VS Code.
2. In the Ubuntu terminal install PostgreSQL and the extension:

```bash
sudo apt-get update
sudo apt-get install postgresql-16 postgresql-16-pgvector
```

3. In VS Code's **Windows PowerShell** terminal run:

```powershell
python -m pip install -r requirements.txt
npm.cmd install
npm.cmd run db:setup
npm.cmd run dev
```

`db:setup` generates `.env.local`, creates a dedicated restricted database login,
creates `pantrychef_app`, restores the original seed into that **new database**,
adds the app schema, hashes an administrator password, trains embeddings, and
adds five coherent starter recipes. It does not drop existing databases.
Subsequent runs are idempotent. Never share `.env.local`, `.generated`, user data,
or `node_modules`; the supplied ZIP excludes them.

If Python's command is different, set `PYTHON_BIN` in `.env.local` to the executable
path. Start the app again after changing environment variables. Do not change
DATABASE_URL to the old `pantrychef` database: use the new app database.

## Native PostgreSQL, Linux, macOS, Docker, or remote database

The application connects through `DATABASE_URL`; WSL is only a Windows convenience.
Copy `.env.example` to `.env.local` and enter your own connection URL and setup
administrator details. Use a dedicated role that owns the project's tables.
Restore `database/pantrychef_seed_dump.sql` into an **empty** database after
replacing `OWNER TO postgres` with your project's database role. Use a current
PostgreSQL 16 client supporting `\restrict`. Install pgvector first. Then run:

```text
python -m pip install -r requirements.txt
npm install
npm run db:setup
npm run dev
```

Outside the default Windows/WSL setup, the database must already exist and contain
the seed schema. Setup does not create a remote database or install pgvector.
Use environment-specific TLS settings for remote databases. Production hosting
needs HTTPS; production session cookies are Secure. This is a local classroom
app, not an externally deployed service.

## Data and search behavior

- Default dataset: **906 recipes**, 84 ingredients, 60 original sample users plus
  the setup admin. It combines 900 synthetic vectorized recipes, one existing
  seed demo recipe, and five coherent starter recipes. User submissions add more.
- Matching means **ingredient names**, not quantity sufficiency or substitutions.
  Only required ingredients count in the percentage. Any required-ingredient
  overlap qualifies; select **Ready to cook only** to require a complete match.
- Vegetarian/vegan filters exclude known meat/dairy ingredient names. They are
  catalogue-based examples; unstructured instructions are not certified dietary
  or allergy labels. Stock is conservatively excluded because its origin is unknown.
- Semantic search uses locally trained TF-IDF and TruncatedSVD/LSA, normalized
  128-dimensional vectors, and cosine distance. It is a vocabulary-dependent
  baseline rather than a hosted language model. Embeddings include recipe titles,
  instructions, and structured ingredient names. The model is rebuilt on a fresh
  setup and used by the Node backend to embed new searches and submissions.
- Synthetic instructions may mention items absent from their structured lists;
  these recipes are labeled in the detail view. Starter recipes avoid that issue.

## Development and validation

```powershell
npm.cmd run build
npm.cmd run start
```

For tests, keep a dev or production server running in one terminal. In another:

```powershell
npm.cmd test
node scripts/benchmark.mjs
```

Integration tests create temporary accounts and recipes and clean them up. Tests
require the setup admin credentials to remain configured. Tests cover pantry
matching, semantic/full-text search, approval permissions, saves, ratings,
session revocation, validation, and transaction rollback. Production builds use
Webpack explicitly for a reproducible local build. Dependencies are locked in
`pnpm-lock.yaml`; npm is also supported for a fresh install.

Optional **synthetic performance dataset**, not 100,000 unique real recipes:

```powershell
node scripts/scale.mjs 100000
node scripts/benchmark.mjs
```

This adds labeled load-test clones until the database reaches the target, up to
200,000 recipes. It rebuilds the vector index and refreshes statistics. Use a
separate test database for long-term experiments; those clones appear in search.
Query plans are written to `docs/QUERY-PLANS.md`. The default friend setup stays
small and practical.

Remove only the labeled synthetic clones afterwards with
`node scripts/remove-load-test.mjs`. Real user submissions are not selected.
`docs/QUERY-PLANS-100K.md` preserves the actual 100,000-row validation run.

## Structure

| Path | Purpose |
| --- | --- |
| `app/page.js`, `app/globals.css` | Responsive React frontend |
| `app/api/[...path]/route.js` | Backend route handlers and authorization |
| `lib/db.mjs` | Parameterized PostgreSQL queries and transactions |
| `lib/auth.mjs`, `lib/security.mjs` | Hashed passwords and opaque sessions |
| `lib/recipes.mjs`, `lib/embeddings.mjs` | Pantry, full-text, and vector search |
| `database/*.sql` | Seed schema, constraints, functions, trigger, indexes, view |
| `scripts/` | Setup, launch, embeddings, load test, query plans |
| `tests/` | Automated security and database/API tests |
| `docs/PROJECT.md` | Requirements mapping, design, schema, demo, responsibilities |
| `docs/TESTING.md` | Validation results and limitations |

## Git / GitHub

Source files are tracked in https://github.com/DarkTJ7/DBMS-MINI-PROJECT.
The initial source import was prepared with Codex assistance. Both members must
review the implementation and make genuine commits for their own contributions.
The ZIP excludes Git metadata. On a friend's machine, run `git init` after extraction.
See the team responsibilities template in `docs/PROJECT.md`.

## Troubleshooting

- **Binary text in VS Code:** extract the ZIP, then use File → Open Folder.
- **npm is missing:** install Node.js from its official distribution and reopen VS Code.
- **Database connection error:** `wsl -d Ubuntu -u root -- pg_ctlcluster 16 main start`;
  then run setup again and keep the app terminal open.
- **pgvector missing:** install `postgresql-16-pgvector` inside Ubuntu, not Windows Python.
- **No recipe matches:** disable Ready to cook, broaden filters, or add more ingredients.
- **Admin login fails after editing .env.local:** editing the setup password does not
  reset an existing account. Setup intentionally does not overwrite existing users.
