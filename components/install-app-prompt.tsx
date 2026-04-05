'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const STORAGE_KEY = 'install-app-prompt-dismissed'

function isIosDevice() {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(ua)
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false

  const iosStandalone =
    'standalone' in window.navigator &&
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)

  const mediaStandalone = window.matchMedia('(display-mode: standalone)').matches

  return iosStandalone || mediaStandalone
}

export default function InstallAppPrompt() {
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    setMounted(true)

    const wasDismissed = window.localStorage.getItem(STORAGE_KEY) === 'true'
    setDismissed(wasDismissed)
    setInstalled(isStandaloneMode())
    setIsIos(isIosDevice())

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleDismiss = () => {
    window.localStorage.setItem(STORAGE_KEY, 'true')
    setDismissed(true)
  }

  const handleInstall = async () => {
    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice

    if (choice.outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  if (!mounted || installed || dismissed) return null

  const showAndroidPrompt = !!deferredPrompt
  const showIosPrompt = isIos

  if (!showAndroidPrompt && !showIosPrompt) return null

  return (
    <div
      style={{
        border: '1px solid #dbeedc',
        background: 'linear-gradient(180deg, #f8fbf7 0%, #ffffff 100%)',
        borderRadius: 18,
        padding: 16,
        display: 'grid',
        gap: 12,
      }}
    >
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>
          📲 Installera Golfrundan
        </div>

        {showAndroidPrompt ? (
          <div className="muted" style={{ lineHeight: 1.5 }}>
            Lägg appen på hemskärmen för snabbare åtkomst och en mer app-lik upplevelse.
          </div>
        ) : null}

        {showIosPrompt ? (
          <div className="muted" style={{ lineHeight: 1.6 }}>
            Lägg appen på hemskärmen:
            <br />
            <strong>1.</strong> Tryck på <strong>Dela</strong>
            <br />
            <strong>2.</strong> Välj <strong>Lägg till på hemskärmen</strong>
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {showAndroidPrompt ? (
          <button
            type="button"
            onClick={handleInstall}
            className="button"
            style={{ flex: 1, minWidth: 180 }}
          >
            Installera app
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleDismiss}
          className="button secondary"
          style={{ flex: 1, minWidth: 180 }}
        >
          Inte nu
        </button>
      </div>
    </div>
  )
}