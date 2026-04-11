import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type AcceptedPageProps = {
  searchParams: Promise<{
    email?: string
  }>
}

export default async function AcceptedPage({ searchParams }: AcceptedPageProps) {
  const params = await searchParams
  const rawEmail = params.email

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const safeEmail =
    typeof rawEmail === 'string' && rawEmail.trim().length > 0
      ? rawEmail.trim().toLowerCase()
      : 'din vän'

  return (
    <main style={{ padding: 24 }}>
      <div className="container" style={{ maxWidth: 680 }}>
        <div
          className="card"
          style={{
            display: 'grid',
            gap: 16,
            borderRadius: 24,
            border: '1px solid #bbf7d0',
            background: 'linear-gradient(180deg, #f0fdf4 0%, #ecfdf3 100%)',
            padding: 20,
          }}
        >
          <span className="badge">🎉 Klar</span>

          <h1 style={{ margin: 0 }}>Vänförfrågan accepterad</h1>

          <p className="muted" style={{ margin: 0 }}>
            Du är nu vän med <strong>{safeEmail}</strong>.
          </p>

          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/profile" className="button">
              Till profil
            </Link>

            <Link href="/dashboard" className="button secondary">
              Till dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}