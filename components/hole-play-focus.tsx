'use client'

import type { CSSProperties } from 'react'

type HolePlayFocusProps = {
  holeNumber: number
  par: number
  playerName: string
  currentPlayerNumber: number
  totalPlayers: number
  strokes: number | null
  loading: boolean
  canGoPrev: boolean
  canSave: boolean
  nextLabel: string
  onChange: (score: number) => void
  onClear: () => void
  onPrev: () => void
  onNext: () => void
}

const styles = {
  page: {
    minHeight: '100dvh',
    display: 'grid',
    gridTemplateRows: 'auto 1fr auto',
    gap: 16,
    padding: '16px 16px calc(24px + env(safe-area-inset-bottom))',
    background:
      'linear-gradient(180deg, rgba(246,250,245,1) 0%, rgba(238,246,238,1) 100%)',
  } satisfies CSSProperties,

  card: {
    borderRadius: 24,
    background: 'rgba(255,255,255,0.9)',
    border: '1px solid rgba(215,224,212,0.95)',
    boxShadow:
      '0 10px 30px rgba(17,24,39,0.06), 0 2px 10px rgba(17,24,39,0.04)',
    backdropFilter: 'blur(10px)',
  } satisfies CSSProperties,

  hero: {
    padding: 18,
    display: 'grid',
    gap: 10,
  } satisfies CSSProperties,

  playerBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    width: 'fit-content',
    padding: '8px 12px',
    borderRadius: 999,
    background: '#ecfdf3',
    color: '#166534',
    fontSize: 13,
    fontWeight: 900,
  } satisfies CSSProperties,

  scoreWrap: {
    display: 'grid',
    alignItems: 'center',
    justifyItems: 'center',
    gap: 18,
    alignSelf: 'center',
  } satisfies CSSProperties,

  scoreRow: {
    display: 'grid',
    gridTemplateColumns: '84px minmax(0, 1fr) 84px',
    gap: 14,
    alignItems: 'center',
    width: '100%',
    maxWidth: 520,
  } satisfies CSSProperties,

  scoreButton: {
    minHeight: 84,
    borderRadius: 24,
    border: 'none',
    background: 'linear-gradient(135deg, #166534 0%, #22c55e 100%)',
    color: '#fff',
    fontSize: 36,
    fontWeight: 900,
    boxShadow: '0 18px 36px rgba(34,197,94,0.18)',
    cursor: 'pointer',
  } satisfies CSSProperties,

  scoreDisplay: {
    minHeight: 148,
    width: '100%',
    borderRadius: 28,
    border: '1px solid #dbe7dc',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fbf7 100%)',
    display: 'grid',
    placeItems: 'center',
    padding: 12,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
  } satisfies CSSProperties,

  scoreNumber: {
    fontSize: 88,
    lineHeight: 1,
    fontWeight: 900,
    color: '#193025',
  } satisfies CSSProperties,

  quickGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 10,
    width: '100%',
    maxWidth: 520,
  } satisfies CSSProperties,

  quickButton: {
    minHeight: 64,
    borderRadius: 18,
    border: '1px solid #d7e0d4',
    background: '#fff',
    color: '#193025',
    fontSize: 24,
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 8px 20px rgba(17,24,39,0.05)',
  } satisfies CSSProperties,

  actions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.5fr 1fr',
    gap: 10,
    alignItems: 'stretch',
  } satisfies CSSProperties,

  secondaryButton: {
    minHeight: 60,
    borderRadius: 18,
    border: '1px solid #d7e0d4',
    background: 'linear-gradient(180deg, #f7faf7 0%, #edf5ec 100%)',
    color: '#193025',
    fontSize: 16,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 6px 16px rgba(17,24,39,0.06)',
  } satisfies CSSProperties,

  primaryButton: {
    minHeight: 60,
    borderRadius: 18,
    border: 'none',
    background: 'linear-gradient(135deg, #166534 0%, #22c55e 100%)',
    color: '#fff',
    fontSize: 18,
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 18px 40px rgba(34,197,94,0.24)',
  } satisfies CSSProperties,
}

export function HolePlayFocus({
  holeNumber,
  par,
  playerName,
  currentPlayerNumber,
  totalPlayers,
  strokes,
  loading,
  canGoPrev,
  canSave,
  nextLabel,
  onChange,
  onClear,
  onPrev,
  onNext,
}: HolePlayFocusProps) {
  return (
    <>
      <style>{`
        @media (max-width: 640px) {
          .hp-focus-actions {
            grid-template-columns: 1fr;
          }

          .hp-focus-score-row {
            grid-template-columns: 72px minmax(0, 1fr) 72px;
          }

          .hp-focus-quick-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
      `}</style>

      <div style={styles.page}>
        <div style={{ ...styles.card, ...styles.hero }}>
          <div style={styles.playerBadge}>
            👤 {playerName} · Spelare {currentPlayerNumber} / {totalPlayers}
          </div>

          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: '#587060',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              Nu spelar ni
            </div>

            <div
              style={{
                fontSize: 'clamp(2rem, 8vw, 3.2rem)',
                lineHeight: 1,
                fontWeight: 900,
                color: '#163322',
                marginBottom: 8,
              }}
            >
              Hål {holeNumber}
            </div>

            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: '#475569',
              }}
            >
              Par {par}
            </div>
          </div>
        </div>

        <div style={styles.scoreWrap}>
          <div className="hp-focus-score-row" style={styles.scoreRow}>
            <button
              type="button"
              onClick={() => onChange(Math.max(1, (strokes ?? 2) - 1))}
              disabled={loading}
              style={{
                ...styles.scoreButton,
                opacity: loading ? 0.6 : 1,
              }}
            >
              −
            </button>

            <div style={styles.scoreDisplay}>
              <div style={styles.scoreNumber}>{strokes ?? '-'}</div>
            </div>

            <button
              type="button"
              onClick={() => onChange((strokes ?? 0) + 1)}
              disabled={loading}
              style={{
                ...styles.scoreButton,
                opacity: loading ? 0.6 : 1,
              }}
            >
              +
            </button>
          </div>

          <div className="hp-focus-quick-grid" style={styles.quickGrid}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => onChange(n)}
                disabled={loading}
                style={{
                  ...styles.quickButton,
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="hp-focus-actions" style={styles.actions}>
          <button
            type="button"
            onClick={onPrev}
            disabled={!canGoPrev || loading}
            style={{
              ...styles.secondaryButton,
              opacity: !canGoPrev || loading ? 0.6 : 1,
              cursor: !canGoPrev || loading ? 'not-allowed' : 'pointer',
            }}
          >
            ← Föregående
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={!canSave || loading}
            style={{
              ...styles.primaryButton,
              opacity: !canSave || loading ? 0.6 : 1,
              cursor: !canSave || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Sparar...' : nextLabel}
          </button>

          <button
            type="button"
            onClick={onClear}
            disabled={loading || strokes == null}
            style={{
              ...styles.secondaryButton,
              opacity: loading || strokes == null ? 0.6 : 1,
              cursor: loading || strokes == null ? 'not-allowed' : 'pointer',
            }}
          >
            Rensa
          </button>
        </div>
      </div>
    </>
  )
}