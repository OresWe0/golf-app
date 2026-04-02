import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

  // 🔥 VIKTIGT: använd SERVICE ROLE
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

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
    `${SITE_URL}/admin/users?message=${encodeURIComponent(
      'Användaren är godkänd'
    )}`
  )
}