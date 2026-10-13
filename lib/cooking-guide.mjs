export function cookingGuide(recipe) {
 const names=recipe.ingredients.map(i=>i.name),has=n=>names.includes(n);
 const prep='Measure the quantities shown in the ingredient list before you begin. Keep optional ingredients separate; you can leave them out. Set out a chopping board, knife, saucepan or frying pan, and a serving dish.';
 const vegetables='Wash the vegetables. Peel onion and garlic if listed; finely chop the onion and mince the garlic. Cut tomatoes into small pieces. Wipe mushrooms clean and slice them evenly so they cook at the same rate.';
 const finish='Taste a small portion once everything is cooked. Add only the optional seasonings listed, a little at a time. Serve warm. Refrigerate leftovers promptly in a covered container.';
 const curated={
 'Creamy Garlic Mushroom Pasta':[
 prep,'Bring a large saucepan of water to a rolling boil. Add the pasta and stir to prevent sticking. Cook for the time printed on the packet, tasting a piece near the end; it should be tender with a slight bite. Reserve half a cup of cooking water before draining.',
 vegetables,'Heat the butter in a wide frying pan over medium heat until melted. Add the mushrooms in a loose layer. Cook for 6–8 minutes, stirring occasionally, until the released liquid mostly evaporates and the mushrooms have golden edges.',
 'Stir in the minced garlic and cook for 30–60 seconds until fragrant. Lower the heat before it browns. Pour in the cream and simmer gently for 2–3 minutes, stirring; avoid a vigorous boil.',
 'Add the drained pasta and toss for 1–2 minutes until coated. If the sauce is too thick, add the reserved pasta water one tablespoon at a time. If too thin, simmer briefly while stirring.',finish],
 'Garlic Butter Mushrooms':[prep,vegetables,'Melt the butter in a wide frying pan over medium heat. Add the mushrooms in a single layer; cook in batches if they overlap heavily. Leave them undisturbed for about 2 minutes to start browning.',
 'Cook for another 5–7 minutes, stirring occasionally. The mushrooms will release water first; continue until most of it evaporates and the edges become golden. Lower the heat if the butter starts to smoke.',
 'Add the minced garlic and stir for 30–60 seconds. Remove from the heat as soon as the garlic smells fragrant; burnt garlic tastes bitter.',finish],
 'One-Pot Tomato Chicken Rice':[prep,vegetables,'Rinse the rice in a sieve until the water runs mostly clear. Cut the chicken into evenly sized bite-size pieces on a separate board. Wash hands and utensils after handling raw chicken.',
 'Put the chicken, onion, tomato, garlic and rinsed rice in a heavy saucepan. Add the amount of water specified on the rice packet for your measured rice; tomatoes also release liquid, so avoid adding extra water immediately. Add the listed optional seasonings if desired.',
 'Bring to a gentle boil over medium heat, stir once, then cover and turn the heat to low. Simmer for the rice packet’s cooking time, usually 15–20 minutes for white rice. Keep the lid on and avoid stirring repeatedly.',
 'Check the rice and chicken. If the rice is firm and the pot is dry, add 2–3 tablespoons of hot water, cover and cook a few minutes longer. Check several thick chicken pieces with a food thermometer: they must reach 74°C / 165°F. Continue cooking if necessary.',
 'Turn off the heat and leave covered for 5 minutes. Fluff gently with a fork and serve. Cooking time varies with rice type; use the package directions rather than the estimate alone.'],
 'Simple Tomato Garlic Rice':[prep,vegetables,'Rinse the rice in a sieve until the water is mostly clear. Put it in a saucepan with the chopped tomato, onion and garlic. Add water using the ratio on your rice packet; start with that amount and adjust only if needed.',
 'Bring to a gentle boil over medium heat. Stir once, cover with a close-fitting lid and reduce to low. Cook for the time on the rice packet, usually 15–20 minutes for white rice. Avoid lifting the lid frequently.',
 'Check a few grains. If still firm and dry, add a splash of hot water and cook covered for another 3–5 minutes. If excess liquid remains, cook uncovered briefly on low. Turn off the heat and rest covered for 5 minutes.',
 'Fluff gently with a fork. Stir in the listed optional basil and salt if desired, then serve warm.'],
 'Mushroom Garlic Rice':[prep,vegetables,'Rinse the rice until the water runs mostly clear. Place the rice, sliced mushrooms and minced garlic in a saucepan. Add water according to the rice packet; mushrooms will release some additional moisture.',
 'Bring to a gentle boil over medium heat, then stir once, cover and lower the heat. Simmer for the packet’s cooking time, generally 15–20 minutes for white rice. Keep the heat low enough to prevent the bottom scorching.',
 'Check that the grains are tender. If the pot is dry but the rice is firm, add a little hot water and cook covered for a few more minutes. Remove from the heat and rest covered for 5 minutes.',
 'Fluff gently. If using the optional butter, fold it into the hot rice until melted. Add the listed optional black pepper and serve warm.']};
 if(curated[recipe.title])return {label:'Step-by-step instructions',steps:curated[recipe.title],suggested:false};
 const steps=[prep];
 if(names.some(n=>['onion','garlic','tomato','mushroom','carrot','potato','broccoli','spinach'].includes(n)))steps.push(vegetables);
 if(has('rice'))steps.push('Cook rice separately using the water ratio and cooking time on its packet. Bring to a boil, cover and simmer on low. Rest covered for 5 minutes before fluffing. Add it to the dish only when the original method calls for it.');
 if(has('pasta')||has('noodles'))steps.push('Cook pasta or noodles separately according to the packet, stirring at the start to prevent sticking. Reserve a little cooking water, then drain. Combine with the other cooked ingredients near the end so it does not become mushy.');
 if(names.some(n=>['chicken breast','turkey','ground beef','pork loin','lamb','shrimp','salmon','tuna','bacon'].includes(n)))steps.push('Keep raw meat or seafood separate from ready-to-eat ingredients. Cut into even pieces and follow the original cooking method. Use a thermometer: chicken or turkey 74°C / 165°F; ground beef 71°C / 160°F; whole cuts of pork or lamb 63°C / 145°F followed by a 3-minute rest; fish 63°C / 145°F. Cook shrimp until opaque and firm. Do not rely on colour alone for meat.');
 steps.push('Follow the original method below, adding ingredients in its stated order. Start aromatics on medium heat, lower the heat if they brown too quickly, and stir occasionally to prevent sticking. Use the listed quantities; do not assume ingredients mentioned only in the demo text are available.');
 steps.push('Check the components before serving: vegetables should be tender when pierced, grains should have no hard centre, and any meat must meet its safe temperature. If grains are dry but undercooked, add a small splash of hot water and cook longer; if a sauce is watery, simmer uncovered briefly.');
 steps.push(finish);
 return {label:recipe.is_sample?'Suggested preparation guide':'Preparation guide',steps,suggested:true};
}
