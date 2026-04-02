import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = 'sigge@dufvander.se'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user.email !== ADMIN_EMAIL) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const formData = await request.formData()
  const userId = String(formData.get('userId') || '')

  if (!userId) {
    return NextResponse.redirect(new URL('/admin/users', request.url))
  }

  await supabase
    .from('profiles')
    .update({ is_approved: true })
    .eq('id', userId)

  return NextResponse.redirect(new URL('/admin/users', request.url))
}