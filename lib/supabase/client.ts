import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = 'https://lforhhemnyustsbpvfrm.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_ENogKoCUCWQynY2zBxiB2w_zHN4yjXB'

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}