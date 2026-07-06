'use client'
import {createClient} from '@/lib/supabase/client'
export default function AuthClient(){async function login(){const supabase=createClient();await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+'/auth/callback'}})}return <button onClick={login}>Sign in with Google</button>}
