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
    const timeoutA = window.setTimeout(run, 80)
    const timeoutB = window.setTimeout(run, 220)
    const timeoutC = window.setTimeout(run, 420)

    const cleanupUrl = window.setTimeout(() => {
      const url = new URL(window.location.href)
      if (!url.searchParams.has('focus')) return
      url.searchParams.delete('focus')
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    }, 500)

    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(timeoutA)
      window.clearTimeout(timeoutB)
      window.clearTimeout(timeoutC)
      window.clearTimeout(cleanupUrl)
    }
  }, [targetId])

  return null
}
