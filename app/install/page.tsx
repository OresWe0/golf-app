import InstallAppPrompt from '@/components/install-app-prompt'

export default function InstallPage() {
  return (
    <main
      style={{
        padding: 20,
        display: 'grid',
        gap: 16,
        maxWidth: 520,
        margin: '0 auto',
      }}
    >
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>
          Installera Golf-appen ⛳
        </h1>
        <p style={{ marginTop: 8 }}>
          Få snabbare scoring och öppna rundan direkt från hemskärmen.
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
        <strong>Varför installera?</strong>
        <ul style={{ marginTop: 8 }}>
          <li>⚡ Snabbare än webben</li>
          <li>📱 Känns som en riktig app</li>
          <li>⛳ Perfekt under rundan</li>
        </ul>
      </div>

      {/* 👇 DIN KOMPONENT */}
      <InstallAppPrompt />
    </main>
  )
}