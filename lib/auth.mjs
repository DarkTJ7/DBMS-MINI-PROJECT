import { cookies } from 'next/headers';
import { sql } from './db.mjs';
import { ApiError,tokenHash,newToken } from './security.mjs';
export async function currentUser() {
 const token=(await cookies()).get('pantrychef_session')?.value;
 if(!token)return null;
 const [user]=await sql(`SELECT u.user_id,u.name,u.email,u.role FROM app_sessions s JOIN users u USING(user_id)
 WHERE token_hash=$1 AND expires_at>now()`,[tokenHash(token)]);return user||null;
}
export async function requireUser(admin=false) {
 const user=await currentUser();if(!user)throw new ApiError('Please sign in first.',401);
 if(admin&&user.role!=='admin')throw new ApiError('Administrator access required.',403);return user;
}
export async function login(user) {
 const token=newToken();await sql('DELETE FROM app_sessions WHERE expires_at<now()');
 await sql(`INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')`,[tokenHash(token),user.user_id]);
 (await cookies()).set('pantrychef_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:604800});
}
export async function logout() {
 const cookie=await cookies(),token=cookie.get('pantrychef_session')?.value;
 if(token)await sql('DELETE FROM app_sessions WHERE token_hash=$1',[tokenHash(token)]);
 cookie.delete('pantrychef_session');
}
