import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://golf-app-hk79.onrender.com'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(
      `${SITE_URL}/login?message=${encodeURIComponent('Ogiltig eller saknad verifieringskod.')}`
    )
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      `${SITE_URL}/login?message=${encodeURIComponent(error.message)}`
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(
      `${SITE_URL}/login?message=${encodeURIComponent('Kunde inte läsa användaren efter verifiering.')}`
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_approved')
    .eq('id', user.id)
    .single()

  if (!profile?.is_approved) {
    return NextResponse.redirect(`${SITE_URL}/pending`)
  }

  return NextResponse.redirect(`${SITE_URL}/dashboard`)
}