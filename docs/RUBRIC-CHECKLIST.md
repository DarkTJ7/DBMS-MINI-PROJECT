# PantryChef rubric checklist

Checked against the supplied PES University DBMS Level 3 evaluation PDF.
This is an evidence map, not an awarded score or guarantee of full marks.

| Evaluation component | Max | Project evidence |
| --- | ---: | --- |
| ER diagram | 2 | PROJECT.md Mermaid ER diagram; student review/final presentation required |
| Relational schema, keys, relationships, constraints | 3 | PROJECT.md dictionary; database/schema.sql, app.sql, integrity.sql |
| SQL DDL implementation with constraints | 4 | Database SQL files, idempotent setup and real database tests |
| NoSQL/vector database creation | 4 | PostgreSQL pgvector extension, VECTOR(128), IVFFlat index, fitted LSA embeddings |
| Technology justification | 1 | PROJECT.md architecture and database/model rationale |
| DML operations | 4 | Register, create/edit/delete recipes, pantry, saves and ratings |
| Nested/correlated queries and joins | 4 | lib/recipes.mjs, pantry_match, demo_queries.sql |
| Procedure/function, trigger, CTE | 6 | add_recipe_with_ingredients, pantry_match, fn_update_avg_rating; WITH matched/params and anchor |
| Vector features, Read/Update/Delete | 7 | Meaning search; admin edit regenerates embedding; deletion removes vector row; integration test assertions |
| Next.js interface | 3 | app/page.js, globals.css, desktop/mobile screenshots |
| Backend/API and DB integration | 2 | app/api/[...path]/route.js, parameterized SQL and transactions |
| Authentication, >=2 roles, database RBAC | 4 | Salted scrypt; database sessions; user/admin API guards; non-owner runtime grants and RLS in access.sql; direct DB tests |
| Documentation, Git/GitHub | 2 | Public extracted source, README, PROJECT, TESTING, screenshots, preserved query plans |
| Originality, individual contribution, modification/viva | 4 | Codex assistance disclosed. Both students must supply genuine work, explain/modify it and satisfy instructor policy; not certified by this checklist |
| Total | 50 | Marks are decided by the evaluator |

## Submission tasks that cannot be completed by automation

- Obtain any required instructor approval for the title and team.
- Tanishk must accept the collaborator invitation and verify his own commit email.
- Each member must make and test real changes and commit them under their own account.
  Never reassign generated/existing work to simulate equal contributions.
- Review the ER/schema deliverables and show them in the instructor's required format.
- Rehearse the live demonstration and individual modification/viva questions.
- Disclose assistance according to the course rules; check originality requirements.

Existing SQL/features and tests are implementation evidence. Screenshots alone do
not establish correctness, originality, individual ownership or a final score.
