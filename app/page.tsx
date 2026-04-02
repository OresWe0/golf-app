import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <main>
      <div className="container">
        <section className="hero">
          <span className="badge">⛳ Hole-by-hole golfapp</span>
          <h1>Golfrundan</h1>
          <p className="muted">
            Starta en runda, välj bana, mata in resultat för hela bollen hål för hål,
            och få summering av slag och Stableford direkt.
          </p>
          <div className="row">
            <Link className="button" href="/login">Logga in</Link>
            <Link className="button secondary" href="/login">Skapa konto</Link>
          </div>
        </section>

        <section className="grid grid-3">
          <div className="card"><h3>Välj bana</h3><p className="muted">Banans par och index hämtas automatiskt från databasen.</p></div>
          <div className="card"><h3>Spela hål för hål</h3><p className="muted">Du landar på hål 1 och går vidare till nästa hål efter varje inmatning.</p></div>
          <div className="card"><h3>Summering direkt</h3><p className="muted">Appen visar slag, mot par och Stableford löpande.</p></div>
        </section>
      </div>
    </main>
  )
}
