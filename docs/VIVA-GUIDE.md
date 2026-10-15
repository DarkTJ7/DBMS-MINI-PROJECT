# PantryChef demonstration and viva practice

## Ten-minute demonstration

1. Explain the pantry problem and the choice of relational storage + pgvector.
2. Show the ER diagram, many-to-many recipe ingredients and composite keys.
3. Search mushroom, garlic, butter, pasta, cream; explain required coverage and missing items.
4. Compare Keyword search with Meaning search; explain TF-IDF, SVD and cosine distance.
5. Register a regular account; save pantry, bookmark and rate a recipe.
6. Submit a recipe; show that it is pending and invisible to visitors.
7. As admin approve it; open **Edit recipe**, change title/instructions/ingredients and save.
8. Show PUT validation, updated embedding/full-text search, then deletion/cascade behavior
   using a temporary demo recipe. Do not delete a classmate's or real user's content.
9. Run npm test with the server running. Explain direct DB permission tests and rollback.
10. Show preserved EXPLAIN plans, exact data-size caveats and genuine member commits.

## Questions both members should answer

- Why use RecipeIngredients instead of a comma-separated ingredient column?
- How do foreign keys, CHECK and UNIQUE constraints protect against bad API code?
- What differs between a correlated subquery, a join and a CTE in this project?
- Which procedure, function and trigger exist? Which is used by the web app?
- Why is rating maintenance a trigger? What happens after update or delete?
- Why wrap a recipe and ingredient replacement in a transaction?
- How are passwords stored, and why are session tokens hashed separately?
- How does PostgreSQL derive user/admin from a valid session? Why is runtime not the owner?
- What does RLS hide, and what errors/row counts should unauthorized SQL produce?
- How does transaction-local session context avoid leaking through pooled connections?
- When must an edited recipe's embedding be regenerated?
- What does cosine distance measure? What are LSA vocabulary limitations?
- Why might PostgreSQL ignore an index on a small table?
- Why are the 100K measurements synthetic and not guarantees of current API latency?

## Honest preparation record

For each member, record the date, issue/feature, files changed, tests run and commit
URL for work they actually completed. The proposed responsibility split in PROJECT
is a starting plan, not authorship evidence. Do not invent earlier work or equal counts.

Suggested independent follow-up choices: improve ingredient alias validation and
add its tests; improve semantic unknown-vocabulary help and add its tests. Choose,
implement, review and understand changes yourselves, with assistance disclosed.
