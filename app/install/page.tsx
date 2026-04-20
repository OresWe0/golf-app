import InstallAppPrompt from '@/components/install-app-prompt'

export default function InstallPage() {
  return (
    <main
      style={{
        padding: 20,
        display: 'grid',
        gap: 16,
        maxWidth: 640,
        margin: '0 auto',
      }}
    >
      <div>
        <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0 }}>
          {'Installera Golf-appen'}
        </h1>
        <p style={{ marginTop: 8 }}>
          {'F\u00e5 snabbare scoring och \u00f6ppna rundan direkt fr\u00e5n hemsk\u00e4rmen.'}
        </p>
      </div>

      <div
        style={{
          padding: 16,
          borderRadius: 16,
          background: '#f8fbf7',
          border: '1px solid #dbeedc',
        }}
      >
        <strong>{'Varf\u00f6r installera?'}</strong>
        <ul style={{ marginTop: 8, marginBottom: 0, lineHeight: 1.6 }}>
          <li>{'Snabbare \u00e4n webben'}</li>
          <li>{'K\u00e4nns som en riktig app'}</li>
          <li>{'Perfekt under rundan'}</li>
        </ul>
      </div>

      <section
        aria-label="Installera p\u00e5 Android"
        style={{
          padding: 16,
          borderRadius: 16,
          background: '#ffffff',
          border: '1px solid #dbe7df',
          display: 'grid',
          gap: 10,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>
          {'Installera som app - Android (Chrome)'}
        </h2>
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          <li>{'\u00d6ppna golf-appen i Chrome p\u00e5 din Android-telefon.'}</li>
          <li>{'Tryck p\u00e5 menyn (\u22ee eller \u2630) uppe till h\u00f6ger.'}</li>
          <li>{'V\u00e4lj "Installera app" eller "L\u00e4gg till p\u00e5 startsk\u00e4rmen".'}</li>
          <li>{'Bekr\u00e4fta installationen.'}</li>
        </ol>
        <p className="muted" style={{ margin: 0 }}>
          {
            'Om appen redan \u00e4r installerad kan du fortfarande anv\u00e4nda den via ikonen p\u00e5 hemsk\u00e4rmen.'
          }
        </p>
      </section>

      <section
        aria-label="Installera p\u00e5 iPhone"
        style={{
          padding: 16,
          borderRadius: 16,
          background: '#ffffff',
          border: '1px solid #dbe7df',
          display: 'grid',
          gap: 10,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>
          {'Installera som app - iPhone (Safari)'}
        </h2>
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          <li>{'\u00d6ppna golf-appen i Safari p\u00e5 din iPhone.'}</li>
          <li>{'Tryck p\u00e5 Dela-knappen (fyrkant med pil upp\u00e5t).'}</li>
          <li>{'V\u00e4lj "L\u00e4gg till p\u00e5 hemsk\u00e4rmen".'}</li>
          <li>{'Tryck p\u00e5 "L\u00e4gg till" f\u00f6r att spara appikonen.'}</li>
        </ol>
        <p className="muted" style={{ margin: 0 }}>
          {
            'Har du redan appikonen? D\u00e5 kan du ignorera stegen och bara \u00f6ppna appen direkt fr\u00e5n hemsk\u00e4rmen.'
          }
        </p>
      </section>

      <InstallAppPrompt />
    </main>
  )
}

