"""Interactive ingredient search against the local PantryChef PostgreSQL database."""
import argparse
import difflib
import json
import subprocess
import sys


def query(sql):
    result = subprocess.run(
        ['wsl', '-d', 'Ubuntu', '-u', 'postgres', '--', 'psql',
         '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-d', 'pantrychef'],
        input=sql, text=True, encoding='utf-8', capture_output=True,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.strip())
    return json.loads(result.stdout.strip())


def ingredients(text, known):
    aliases = {'chicken': 'chicken breast', 'beef': 'ground beef',
               'egg': 'eggs', 'tomatoes': 'tomato', 'onions': 'onion',
               'potatoes': 'potato', 'mushrooms': 'mushroom',
               'chilli powder': 'chili powder', 'chilli': 'green chili',
               'yoghurt': 'yogurt', 'aubergine': 'eggplant'}
    found, unknown = set(), []
    for item in text.split(','):
        item = item.strip().lower().rstrip('.').strip()
        if not item:
            continue
        name = aliases.get(item, item)
        if name in known:
            found.add(name)
        else:
            suggestion = difflib.get_close_matches(name, known, n=1)
            unknown.append(
                item + (f" (did you mean {suggestion[0]}?)" if suggestion else ''))
    return sorted(found), unknown


def search(names):
    # Names have already been checked against the ingredient catalogue. Quote
    # SQL literals as well; never interpolate arbitrary user input into SQL.
    literals = ','.join("'" + name.replace("'", "''") + "'" for name in names)
    return query(f"""
    WITH owned AS (SELECT ingredient_id FROM ingredients WHERE name IN ({literals})),
    ranked AS (
      SELECT r.recipe_id, r.title, r.prep_time_min, r.instructions, r.avg_rating,
        count(*) FILTER (WHERE NOT ri.is_optional) AS required,
        count(*) FILTER (WHERE NOT ri.is_optional AND o.ingredient_id IS NOT NULL) AS matched,
        count(*) FILTER (WHERE NOT ri.is_optional AND o.ingredient_id IS NULL) AS missing_count,
        coalesce(json_agg(i.name ORDER BY i.name) FILTER
          (WHERE NOT ri.is_optional AND o.ingredient_id IS NULL), '[]'::json) AS missing,
        json_agg(json_build_object('name', i.name, 'quantity', ri.quantity,
          'unit', ri.unit, 'optional', ri.is_optional) ORDER BY i.name) AS ingredients
      FROM recipes r
      JOIN recipe_ingredients ri ON ri.recipe_id = r.recipe_id
      JOIN ingredients i ON i.ingredient_id = ri.ingredient_id
      LEFT JOIN owned o ON o.ingredient_id = ri.ingredient_id
      WHERE r.embedding IS NOT NULL
      GROUP BY r.recipe_id
      HAVING count(*) FILTER (WHERE NOT ri.is_optional AND o.ingredient_id IS NOT NULL) > 0
      ORDER BY missing_count, matched DESC, r.avg_rating DESC, r.recipe_id
      LIMIT 100
    ) SELECT coalesce(json_agg(ranked), '[]'::json) FROM ranked;
    """)


def display(rows):
    unique, seen = [], set()
    for row in rows:
        if row['title'] not in seen:
            seen.add(row['title'])
            unique.append(row)
        if len(unique) == 10:
            break
    print('\nDISHES YOU CAN MAKE WITH YOUR INGREDIENTS')
    ready = [r for r in unique if not r['missing_count']]
    if not ready:
        print('No recipe has all its required ingredients in your pantry.')
    print('\nBEST MATCHES (optional ingredients do not count as missing)')
    for index, row in enumerate(unique, 1):
        status = 'Ready to cook' if not row['missing_count'] else 'Missing: ' + ', '.join(
            row['missing'])
        print(f"{index}. {row['title']} | {row['prep_time_min']} min | "
              f"{row['matched']}/{row['required']} required ingredients\n   {status}")
    if not unique:
        print('No matching recipes found.')
    return unique


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--ingredients', help='Comma-separated ingredient names')
    args = parser.parse_args()
    print('PantryChef - Enter your ingredients to find dishes')
    print('This is a synthetic recipe demo; matching checks ingredient names, not quantities.')
    known = query("SELECT json_agg(name ORDER BY name) FROM ingredients;")
    while True:
        text = args.ingredients or input(
            '\nIngredients (comma-separated; list for catalogue; q to quit): ')
        if text.strip().lower() in ('q', 'quit', 'exit'):
            return
        if text.strip().lower() == 'list':
            print(', '.join(known))
            if args.ingredients:
                return
            continue
        names, unknown = ingredients(text, known)
        if unknown:
            print('Unrecognized ingredients: ' + '; '.join(unknown))
        if not names:
            print('Enter at least one ingredient from the catalogue.')
            if args.ingredients:
                return
            continue
        print('Your pantry: ' + ', '.join(names))
        rows = display(search(names))
        if args.ingredients:
            return
        while rows:
            choice = input(
                '\nEnter a dish number for its recipe, Enter for a new pantry, or q to quit: ').strip()
            if choice.lower() == 'q':
                return
            if not choice:
                break
            if not choice.isdigit() or not 1 <= int(choice) <= len(rows):
                print('Choose a number shown above.')
                continue
            row = rows[int(choice) - 1]
            print('\n' + row['title'])
            for ingredient in row['ingredients']:
                suffix = ' (optional)' if ingredient['optional'] else ''
                print(
                    f"  {ingredient['quantity']} {ingredient['unit']} {ingredient['name']}{suffix}")
            print('\nInstructions: ' + row['instructions'])


if __name__ == '__main__':
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        print('\nGoodbye!')
    except RuntimeError as error:
        print(
            f'Database error: {error}\nRun start.ps1 and try again.', file=sys.stderr)
        sys.exit(1)
