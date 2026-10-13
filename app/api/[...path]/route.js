import {NextResponse} from 'next/server';
import {sql,transaction} from '../../../lib/db.mjs';
import {currentUser,requireUser,login,logout} from '../../../lib/auth.mjs';
import {ApiError,credentials,hashPassword,verifyPassword,text,integer,ids,checkOrigin,rateLimit} from '../../../lib/security.mjs';
import {findRecipes,recipeDetail} from '../../../lib/recipes.mjs';
import {embed} from '../../../lib/embeddings.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handle(request,context) {
 try {
  const {path}=await context.params;const key=path.join('/'),method=request.method;
  const url=new URL(request.url),p=url.searchParams;
  if(method!=='GET')checkOrigin(request);
  let body={};if(['POST','PUT','PATCH'].includes(method)) {
   const raw=await request.text();if(raw.length>25000)throw new ApiError('Request is too large.',413);
   try{body=JSON.parse(raw);}catch{throw new ApiError('Invalid JSON request.');}
   if(!body||typeof body!=='object'||Array.isArray(body))throw new ApiError('Invalid request body.');
  }
  let result;
  if(key==='meta'&&method==='GET') {
   const [ingredients,cuisines,stats]=await Promise.all([
    sql('SELECT ingredient_id,name,category FROM ingredients ORDER BY name'),
    sql('SELECT * FROM cuisine_summary ORDER BY cuisine'),
    sql(`SELECT (SELECT count(*) FROM recipes WHERE status='approved') AS recipes,
     (SELECT count(*) FROM ingredients) AS ingredients,(SELECT count(*) FROM users) AS cooks`)]);
   result={ingredients,cuisines,stats:stats[0]};
  }else if(key==='auth/me'&&method==='GET')result={user:await currentUser()};
  else if(['auth/login','auth/register'].includes(key)&&method==='POST') {
   const signup=key==='auth/register';const {email,password}=credentials(body,signup);
   rateLimit(email);
   let user;
   if(signup) {
    const name=text(body.name,'Name',100);
    [user]=await sql(`INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'user') RETURNING user_id,name,email,role`,[name,email,hashPassword(password)]);
   }else {
    [user]=await sql('SELECT user_id,name,email,role,password_hash FROM users WHERE email=$1',[email]);
    if(!user||!verifyPassword(password,user.password_hash))throw new ApiError('Email or password is incorrect.',401);
    delete user.password_hash;
   }
   await login(user);result={user};
  }else if(key==='auth/logout'&&method==='POST'){await logout();result={ok:true};}
  else if(key==='pantry') {
   const user=await requireUser();
   if(method==='GET')result={ingredientIds:(await sql('SELECT ingredient_id FROM user_pantry WHERE user_id=$1',[user.user_id])).map(x=>x.ingredient_id)};
   else if(method==='PUT') {
    const selected=ids(body.ingredientIds);
    const count=await sql('SELECT count(*)::int AS n FROM ingredients WHERE ingredient_id=ANY($1::int[])',[selected]);
    if(count[0].n!==selected.length)throw new ApiError('Unknown ingredient.');
    await transaction(async client=>{
     await client.query('SELECT user_id FROM users WHERE user_id=$1 FOR UPDATE',[user.user_id]);
     await client.query('DELETE FROM user_pantry WHERE user_id=$1',[user.user_id]);
     await client.query('INSERT INTO user_pantry(user_id,ingredient_id,quantity) SELECT $1,unnest($2::int[]),1',[user.user_id,selected]);
    });result={ok:true};
   }else if(method==='DELETE'){await sql('DELETE FROM user_pantry WHERE user_id=$1',[user.user_id]);result={ok:true};}
  }else if(key==='recipes'&&method==='GET') {
   const selected=ids((p.get('ingredients')||'').split(',').filter(Boolean));
   const q=(p.get('q')||'').trim();if(q.length>300)throw new ApiError('Search must be at most 300 characters.');
   const page=integer(p.get('page')||1,'Page',1,10000);
   result=await findRecipes({ingredientIds:selected,q,cuisine:p.get('cuisine')||'',diet:p.get('diet')||'',ready:p.get('ready')==='true',mode:p.get('mode')||'pantry',page});
  }else if(key==='saved'&&method==='GET') {
   const user=await requireUser();result=await findRecipes({savedUser:user.user_id,page:integer(p.get('page')||1,'Page',1,10000)});
  }else if(path[0]==='saved'&&path.length===2) {
   const user=await requireUser(),id=integer(path[1],'Recipe ID');
   if(method==='POST') {
    await recipeDetail(id,user.user_id);
    await sql('INSERT INTO saved_recipes(user_id,recipe_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[user.user_id,id]);result={ok:true};
   }else if(method==='DELETE'){await sql('DELETE FROM saved_recipes WHERE user_id=$1 AND recipe_id=$2',[user.user_id,id]);result={ok:true};}
  }else if(path[0]==='ratings'&&path.length===2) {
   const user=await requireUser(),id=integer(path[1],'Recipe ID');
   await recipeDetail(id,user.user_id);
   if(method==='PUT') {
    const stars=integer(body.stars,'Stars',1,5),review=body.review?text(body.review,'Review',1000):'';
    await sql(`INSERT INTO ratings(user_id,recipe_id,stars,review_text) VALUES($1,$2,$3,$4)
     ON CONFLICT(user_id,recipe_id) DO UPDATE SET stars=excluded.stars,review_text=excluded.review_text`,[user.user_id,id,stars,review]);result={ok:true};
   }else if(method==='DELETE'){await sql('DELETE FROM ratings WHERE user_id=$1 AND recipe_id=$2',[user.user_id,id]);result={ok:true};}
  }else if(key==='recipes'&&method==='POST') {
   const user=await requireUser();
   const title=text(body.title,'Title',200),instructions=text(body.instructions,'Instructions',10000,20),cuisine=text(body.cuisine,'Cuisine',50);
   const prep=integer(body.prep_time_min,'Prep time',1,600);
   if(!['Easy','Medium','Hard'].includes(body.difficulty))throw new ApiError('Invalid difficulty.');
   if(!Array.isArray(body.ingredients)||body.ingredients.length<1||body.ingredients.length>50)throw new ApiError('Choose 1-50 ingredients.');
   const ingredientIds=ids(body.ingredients.map(x=>x.ingredient_id));
   if(ingredientIds.length!==body.ingredients.length)throw new ApiError('Each ingredient must be unique.');
   const ingredients=body.ingredients.map(i=>{
    const quantity=Number(i.quantity);if(!Number.isFinite(quantity)||quantity<=0||quantity>9999)throw new ApiError('Ingredient quantity must be greater than zero and at most 9999.');
    if(typeof i.is_optional!=='boolean')throw new ApiError('Optional flag must be boolean.');
    return {...i,quantity,unit:text(i.unit,'Unit',20)};
   });
   if(ingredients.every(i=>i.is_optional))throw new ApiError('At least one ingredient must be required.');
   const ingredientNames=await sql('SELECT name FROM ingredients WHERE ingredient_id=ANY($1::int[])',[ingredientIds]);
   if(ingredientNames.length!==ingredientIds.length)throw new ApiError('Unknown ingredient.');
   const vector=embed(title+' '+instructions+' '+ingredientNames.map(i=>i.name).join(' '));
   result=await transaction(async client=>{
    const {rows}=await client.query(`INSERT INTO recipes(title,instructions,cuisine,prep_time_min,difficulty,created_by,embedding,status,is_sample)
     VALUES($1,$2,$3,$4,$5,$6,$7::vector,$8,false) RETURNING recipe_id,status`,[title,instructions,cuisine,prep,body.difficulty,user.user_id,vector,user.role==='admin'?'approved':'pending']);
    for(const i of ingredients)await client.query(`INSERT INTO recipe_ingredients(recipe_id,ingredient_id,quantity,unit,is_optional) VALUES($1,$2,$3,$4,$5)`,[rows[0].recipe_id,i.ingredient_id,i.quantity,i.unit,i.is_optional]);
    return rows[0];
   });
  }else if(path[0]==='recipes'&&path.length===2) {
   const id=integer(path[1],'Recipe ID');
   if(method==='GET'){const user=await currentUser();result={recipe:await recipeDetail(id,user?.user_id,user?.role==='admin')};}
   else {
    await requireUser(true);
    if(method==='DELETE') {const rows=await sql('DELETE FROM recipes WHERE recipe_id=$1 RETURNING recipe_id',[id]);if(!rows.length)throw new ApiError('Recipe not found.',404);result={ok:true};}
    else if(method==='PATCH') {
     if(!['approved','pending','rejected'].includes(body.status))throw new ApiError('Invalid moderation status.');
     const rows=await sql('UPDATE recipes SET status=$1 WHERE recipe_id=$2 RETURNING recipe_id,status',[body.status,id]);
     if(!rows.length)throw new ApiError('Recipe not found.',404);result=rows[0];
    }
   }
  }else if(key==='admin'&&method==='GET') {
   await requireUser(true);
   const [stats,pending,cuisines,recent]=await Promise.all([
    sql(`SELECT (SELECT count(*) FROM recipes) AS recipes,(SELECT count(*) FROM users) AS users,
     (SELECT count(*) FROM ratings) AS ratings,(SELECT count(*) FROM recipe_ingredients) AS links,
     (SELECT count(*) FROM recipes WHERE status='pending') AS pending`),
    sql(`SELECT r.recipe_id,r.title,r.cuisine,u.name AS author FROM recipes r LEFT JOIN users u ON u.user_id=r.created_by WHERE status='pending' ORDER BY r.created_at DESC LIMIT 50`),
    sql('SELECT * FROM cuisine_summary ORDER BY recipe_count DESC'),
    sql(`SELECT recipe_id,title,cuisine,status FROM recipes ORDER BY created_at DESC,recipe_id DESC LIMIT 30`)]);
   result={stats:stats[0],pending,cuisines,recent};
  }
  if(result===undefined)throw new ApiError('Endpoint not found.',404);
  return NextResponse.json(result,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e) {
  if(e.code==='23505')return NextResponse.json({error:'This email is already registered.'},{status:409});
  if(['23503','23514','23502','22003'].includes(e.code))return NextResponse.json({error:'The database rejected invalid data.'},{status:400});
  if(!(e instanceof ApiError))console.error('API error:',e.code||e.name,e.message.replace(/postgresql:\/\/[^\s]+/g,'[database URL]'));
  return NextResponse.json({error:e instanceof ApiError?e.message:'Database request failed. Check the server setup.'},{status:e.status||500});
 }
}
export const GET=handle,POST=handle,PUT=handle,PATCH=handle,DELETE=handle;
