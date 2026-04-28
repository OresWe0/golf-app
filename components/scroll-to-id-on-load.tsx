'use client'

import { useEffect } from 'react'

export default function ScrollToIdOnLoad({
  targetId,
}: {
  targetId: string
}) {
  useEffect(() => {
    const run = () => {
      const element = document.getElementById(targetId)
      if (!element) return
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    const raf = window.requestAnimationFrame(run)
    const timeout = window.setTimeout(run, 120)

    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(timeout)
    }
  }, [targetId])

  return null
}

