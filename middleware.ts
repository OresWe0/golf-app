import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'

const SUPABASE_URL = 'https://lforhhemnyustsbpvfrm.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_ENogKoCUCWQynY2zBxiB2w_zHN4yjXB'
const ADMIN_EMAIL = 'sigge@dufvander.se'

export async function middleware(request: NextRequest) {
  let response = await updateSession(request)

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value)
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const isPublicPath =
    pathname === '/login' ||
    pathname === '/pending'

  if (!user) {
    return response
  }

  if (user.email === ADMIN_EMAIL) {
    return response
  }

  if (isPublicPath) {
    return response
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_approved')
    .eq('id', user.id)
    .single()

  if (!profile?.is_approved) {
    const url = request.nextUrl.clone()
    url.pathname = '/pending'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}