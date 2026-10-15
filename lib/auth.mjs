import { cookies } from 'next/headers';
import { sql,ownerSql } from './db.mjs';
import { ApiError,tokenHash,newToken } from './security.mjs';
export async function currentUser() {
 const token=(await cookies()).get('pantrychef_session')?.value;
 if(!token)return null;
 const [user]=await sql('SELECT user_id,name,email,role FROM users WHERE user_id=app_actor_id()');return user||null;
}
export async function requireUser(admin=false) {
 const user=await currentUser();if(!user)throw new ApiError('Please sign in first.',401);
 if(admin&&user.role!=='admin')throw new ApiError('Administrator access required.',403);return user;
}
export async function login(user) {
 const token=newToken();await ownerSql('DELETE FROM app_sessions WHERE expires_at<now()');
 await ownerSql(`INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')`,[tokenHash(token),user.user_id]);
 (await cookies()).set('pantrychef_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:604800});
}
export async function logout() {
 const cookie=await cookies(),token=cookie.get('pantrychef_session')?.value;
 if(token)await ownerSql('DELETE FROM app_sessions WHERE token_hash=$1',[tokenHash(token)]);
 cookie.delete('pantrychef_session');
}
