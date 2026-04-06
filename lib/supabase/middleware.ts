import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SUPABASE_URL = 'https://lforhhemnyustsbpvfrm.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_ENogKoCUCWQynY2zBxiB2w_zHN4yjXB'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

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

  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/rounds') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/admin')

  const isLoginPage = pathname === '/login'
  const isPendingPage = pathname === '/pending'

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (!user) {
    return response
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_approved')
    .eq('id', user.id)
    .maybeSingle()

  const isApproved = !profileError && profile?.is_approved === true

  if (!isApproved) {
    if (isProtectedPath || isLoginPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/pending'
      return NextResponse.redirect(url)
    }

    return response
  }

  if (isLoginPage || isPendingPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}