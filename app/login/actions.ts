'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://golf-app-hk79.onrender.com'

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') || '')
  const password = String(formData.get('password') || '')
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}`)
  }

  redirect('/dashboard')
}

export async function signUp(formData: FormData) {
  const email = String(formData.get('email') || '')
  const password = String(formData.get('password') || '')
  const displayName = String(formData.get('displayName') || '').trim()
  const handicapIndex = String(formData.get('handicapIndex') || '').trim()
  const defaultTee =
    String(formData.get('defaultTee') || 'yellow').trim() || 'yellow'

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${SITE_URL}/auth/callback`,
      data: {
        display_name: displayName || email.split('@')[0] || 'Golfspelare',
        handicap_index: handicapIndex ? Number(handicapIndex) : null,
        default_tee: defaultTee,
      },
    },
  })

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}`)
  }

  redirect(
    '/login?message=' +
      encodeURIComponent('Kolla din e-post för att verifiera kontot.')
  )
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const displayName = String(formData.get('displayName') || '').trim()
  const handicapIndex = String(formData.get('handicapIndex') || '').trim()
  const defaultTee =
    String(formData.get('defaultTee') || 'yellow').trim() || 'yellow'

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: displayName || user.email?.split('@')[0] || 'Golfspelare',
      handicap_index: handicapIndex ? Number(handicapIndex) : null,
      default_tee: defaultTee,
    })
    .eq('id', user.id)

  if (error) {
    redirect(`/profile?message=${encodeURIComponent(error.message)}`)
  }

  redirect('/profile?message=' + encodeURIComponent('Profil sparad'))
}