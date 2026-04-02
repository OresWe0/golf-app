import { signIn, signUp } from './actions'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const params = await searchParams
  const message = params.message

  return (
    <main>
      <div className="container auth-shell">
        <div className="card stack">
          <div>
            <span className="badge">🔐 Login</span>
            <h1>Logga in eller skapa konto</h1>
            <p className="muted">Varje golfvän kan ha sitt eget konto, sitt HCP och sin standard-tee sparad i profilen.</p>
          </div>

          {message ? <div className="notice">{message}</div> : null}

          <form className="stack" action={signIn}>
            <div>
              <label htmlFor="email">E-post</label>
              <input id="email" name="email" type="email" required />
            </div>
            <div>
              <label htmlFor="password">Lösenord</label>
              <input id="password" name="password" type="password" minLength={6} required />
            </div>
            <button type="submit">Logga in</button>
          </form>

          <hr style={{ width: '100%', border: 0, borderTop: '1px solid #e6ece4' }} />

          <form className="stack" action={signUp}>
            <input name="displayName" type="text" placeholder="Namn" required />
            <input name="email" type="email" placeholder="E-post" required />
            <input name="password" type="password" placeholder="Minst 6 tecken" minLength={6} required />
            <input name="handicapIndex" type="number" step="0.1" min="0" placeholder="Handicapindex, t.ex. 18.4" />
            <select name="defaultTee" defaultValue="yellow">
              <option value="yellow">Standardtee: Gul</option>
              <option value="red">Standardtee: Röd</option>
            </select>
            <button type="submit" className="secondary">Skapa konto</button>
          </form>
        </div>
      </div>
    </main>
  )
}
