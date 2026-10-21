import 'server-only';
import { cookies } from 'next/headers';
import { SupabaseError, SupabaseHttp } from './supabase-http';

export const usesSupabase = () => process.env.NEXT_PUBLIC_BACKEND_PROVIDER === 'supabase';
export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,'');
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new SupabaseError('Supabase is not configured. Set the project URL and publishable key.',503);
  return {url, key};
}
export function publicClient(token?: string) {
  const {url,key} = supabaseConfig(); return new SupabaseHttp(url,key,token);
}
export function serviceClient() {
  const {url} = supabaseConfig(), key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new SupabaseError('Server-side Supabase credentials are not configured.',503);
  return new SupabaseHttp(url,key);
}
type AuthSession = {access_token:string; refresh_token:string; expires_in:number};
export async function saveSession(session: AuthSession) {
  const jar = await cookies();
  const settings = {httpOnly:true, secure:process.env.NODE_ENV === 'production', sameSite:'strict' as const, path:'/api'};
  jar.set('blitz_access',session.access_token,{...settings,maxAge:session.expires_in});
  jar.set('blitz_refresh',session.refresh_token,{...settings,maxAge:60*60*24*7});
}
export async function clearSession() {
  const jar=await cookies(); jar.set('blitz_access','',{path:'/api',maxAge:0}); jar.set('blitz_refresh','',{path:'/api',maxAge:0});
}
export async function userRpc<T>(name: string, body: object = {}): Promise<T> {
  const jar=await cookies(), token=jar.get('blitz_access')?.value, refresh=jar.get('blitz_refresh')?.value;
  try {
    if (!token) throw new SupabaseError('Sign in to continue.',401);
    return await publicClient(token).rpc<T>(name,body);
  } catch (error) {
    if (!(error instanceof SupabaseError) || error.status !== 401 || !refresh) throw error;
    let session: AuthSession;
    try {
      session=await publicClient().request<AuthSession>('/auth/v1/token?grant_type=refresh_token',{
        method:'POST',body:JSON.stringify({refresh_token:refresh}),
      });
    } catch {
      await clearSession(); throw new SupabaseError('Your session expired. Sign in again.',401);
    }
    await saveSession(session);
    return publicClient(session.access_token).rpc<T>(name,body);
  }
}
export async function login(email: string, password: string) {
  const session=await publicClient().request<AuthSession>('/auth/v1/token?grant_type=password',{
    method:'POST',body:JSON.stringify({email,password}),
  });
  // A valid Auth account alone grants no organiser privileges.
  await publicClient(session.access_token).rpc('blitz_admin_me');
  await saveSession(session);
  return {authenticated:true};
}
