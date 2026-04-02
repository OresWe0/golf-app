'use client'

import { useEffect, useState } from 'react'

const loadingTexts = [
  'Laddar din runda...',
  'Plockar fram scorekort...',
  'Räknar handicap...',
  'Förbereder hål 1...',
]

export default function Loading() {
  const [textIndex, setTextIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % loadingTexts.length)
    }, 1800)

    return () => clearInterval(interval)
  }, [])

  return (
    <main className="splash-root">
      <div className="splash-content">
        <div className="logo-wrapper">
          <img src="/icon-192.png" alt="Golfrundan" />
        </div>

        <h1>Golfrundan</h1>

        <p className="loading-text">{loadingTexts[textIndex]}</p>

        <div className="spinner" />
      </div>
    </main>
  )
}