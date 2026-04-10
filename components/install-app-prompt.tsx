'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const STORAGE_KEY = 'install-app-prompt-dismissed-at'
const DISMISS_DAYS = 7

function isIosDevice() {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(ua)
}

function isSafariBrowser() {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent.toLowerCase()
  return (
    ua.includes('safari') &&
    !ua.includes('crios') &&
    !ua.includes('fxios') &&
    !ua.includes('edgios')
  )
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false

  const iosStandalone =
    'standalone' in window.navigator &&
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)

  const mediaStandalone = window.matchMedia('(display-mode: standalone)').matches

  return iosStandalone || mediaStandalone
}

function wasDismissedRecently() {
  if (typeof window === 'undefined') return false

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return false

  const dismissedAt = Number(raw)
  if (!Number.isFinite(dismissedAt)) return false

  const daysSinceDismiss =
    (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24)

  return daysSinceDismiss < DISMISS_DAYS
}

function rememberDismiss() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, String(Date.now()))
}

export default function InstallAppPrompt() {
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [isIosSafari, setIsIosSafari] = useState(false)
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    setMounted(true)

    setDismissed(wasDismissedRecently())
    setInstalled(isStandaloneMode())
    setIsIosSafari(isIosDevice() && isSafariBrowser())

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
    rememberDismiss()
    setDismissed(true)
  }

  const handleInstall = async () => {
    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice

    if (choice.outcome === 'accepted') {
      setDeferredPrompt(null)
      return
    }

    handleDismiss()
  }

  if (!mounted || installed || dismissed) return null

  const showAndroidPrompt = !!deferredPrompt
  const showIosPrompt = isIosSafari

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
        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)',
      }}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            borderRadius: 999,
            background: '#ecfdf3',
            color: '#166534',
            fontSize: 12,
            fontWeight: 900,
            width: 'fit-content',
          }}
        >
          📲 Installera appen
        </div>

        <div style={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>
          Få snabbare åtkomst till Golfrundan
        </div>

        {showAndroidPrompt ? (
          <div className="muted" style={{ lineHeight: 1.5 }}>
            Installera appen för att öppna den snabbare och få en mer app-lik upplevelse på mobilen.
          </div>
        ) : null}

        {showIosPrompt ? (
          <div className="muted" style={{ lineHeight: 1.6 }}>
            Lägg till appen på hemskärmen:
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