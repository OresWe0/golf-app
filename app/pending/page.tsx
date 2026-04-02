import Link from 'next/link'
import { LogoutButton } from '@/components/logout-button'

export default function PendingPage() {
  return (
    <main>
      <div className="container">
        <div className="card" style={{ maxWidth: 560, margin: '40px auto' }}>
          <span className="badge">⏳ Väntar på godkännande</span>
          <h1>Ditt konto är skapat</h1>
          <p className="muted">
            Du är registrerad i Golfrundan, men en administratör behöver först
            godkänna ditt konto innan du kan använda appen.
          </p>

          <div className="row" style={{ marginTop: 16, gap: 12 }}>
            <Link className="button secondary" href="/login">
              Till login
            </Link>
            <LogoutButton label="Logga ut" />
          </div>
        </div>
      </div>
    </main>
  )
}