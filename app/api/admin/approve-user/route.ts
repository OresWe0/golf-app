import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://golf-app-hk79.onrender.com'

export async function POST(req: Request) {
  const formData = await req.formData()
  const userId = String(formData.get('userId') || '')

  if (!userId) {
    return NextResponse.redirect(
      `${SITE_URL}/admin/users?message=${encodeURIComponent('Saknar userId')}`
    )
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${SITE_URL}/login`)
  }

  const { data: me, error: meError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (meError || !me?.is_admin) {
    return NextResponse.redirect(
      `${SITE_URL}/admin/users?message=${encodeURIComponent('Du har inte behörighet att godkänna användare.')}`
    )
  }

  const { error } = await supabase
    .from('profiles')
    .update({ is_approved: true })
    .eq('id', userId)

  if (error) {
    return NextResponse.redirect(
      `${SITE_URL}/admin/users?message=${encodeURIComponent(error.message)}`
    )
  }

  return NextResponse.redirect(
    `${SITE_URL}/admin/users?message=${encodeURIComponent('Användaren är godkänd.')}`
  )
}