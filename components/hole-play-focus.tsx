'use client'

export function HolePlayFocus({
  holeNumber,
  par,
  strokes,
  onChange,
  onNext,
  onPrev,
}) {
  return (
    <div className="focus-container">

      {/* TOP */}
      <div className="focus-header">
        <h1>Hål {holeNumber}</h1>
        <span>Par {par}</span>
      </div>

      {/* SCORE */}
      <div className="focus-score">
        <button onClick={() => onChange(strokes - 1)}>-</button>

        <div className="score-number">{strokes ?? '-'}</div>

        <button onClick={() => onChange(strokes + 1)}>+</button>
      </div>

      {/* QUICK INPUT */}
      <div className="quick-buttons">
        {[1,2,3,4,5,6,7,8].map(n => (
          <button key={n} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
      </div>

      {/* ACTIONS */}
      <div className="focus-actions">
        <button onClick={onPrev}>← Föregående</button>
        <button onClick={onNext}>Spara & nästa →</button>
      </div>

    </div>
  )
}