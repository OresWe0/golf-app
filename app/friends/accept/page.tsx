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

  // 🔐 Säkerställ att man är inloggad
  if (!user) {
    redirect('/login')
  }

  // 🧼 Rensa input snyggt
  const safeEmail =
    typeof rawEmail === 'string' && rawEmail.trim().length > 0
      ? rawEmail.trim().toLowerCase()
      : null

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
            boxShadow: '0 16px 40px rgba(34, 197, 94, 0.12)',
            padding: 20,
          }}
        >
          {/* Badge */}
          <span
            className="badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 999,
              background: '#dcfce7',
              fontWeight: 800,
              width: 'fit-content',
            }}
          >
            🎉 Klar
          </span>

          {/* Titel */}
          <h1 style={{ margin: 0 }}>Vänförfrågan accepterad</h1>

          {/* Text */}
          <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
            {safeEmail ? (
              <>
                Du är nu vän med <strong>{safeEmail}</strong>.
              </>
            ) : (
              <>Vänförfrågan har accepterats.</>
            )}
          </p>

          {/* Extra info (liten UX touch) */}
          <p
            className="muted"
            style={{
              margin: 0,
              fontSize: 14,
              opacity: 0.8,
            }}
          >
            Ni kan nu dela rundor och jämföra resultat i appen.
          </p>

          {/* Knappar */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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