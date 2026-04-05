import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://golf-app-hk79.onrender.com'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const userId = String(formData.get('userId') || '')

    if (!userId) {
      return NextResponse.redirect(
        `${SITE_URL}/admin/users?message=${encodeURIComponent('Saknar userId.')}`
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
      .select('id, is_admin')
      .eq('id', user.id)
      .single()

    if (meError || !me?.is_admin) {
      return NextResponse.redirect(
        `${SITE_URL}/admin/users?message=${encodeURIComponent(
          'Du har inte behörighet att avslå användare.'
        )}`
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.redirect(
        `${SITE_URL}/admin/users?message=${encodeURIComponent(
          'Saknar SUPABASE_SERVICE_ROLE_KEY i Render.'
        )}`
      )
    }

    const admin = createAdminClient(supabaseUrl, serviceRoleKey)

    const { error: deleteError } = await admin.from('profiles').delete().eq('id', userId)

    if (deleteError) {
      return NextResponse.redirect(
        `${SITE_URL}/admin/users?message=${encodeURIComponent(
          `Kunde inte avslå användaren: ${deleteError.message}`
        )}`
      )
    }

    return NextResponse.redirect(
      `${SITE_URL}/admin/users?message=${encodeURIComponent('Användaren har avslagits och tagits bort.')}`
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Okänt fel i deny-route.'
    return NextResponse.redirect(
      `${SITE_URL}/admin/users?message=${encodeURIComponent(message)}`
    )
  }
}