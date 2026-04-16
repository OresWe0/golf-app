'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'

type InstallVariant = 'android-install' | 'android-help' | 'ios' | null

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'install-app-prompt-dismissed-at'
const VISIT_COUNT_KEY = 'install-app-prompt-visit-count'

const DISMISS_DAYS = 7
const ANDROID_FALLBACK_MIN_VISITS = 2
const FALLBACK_DELAY_MS = 1500
const ALLOWED_ROUTES = ['/dashboard', '/install']

function isIosDevice() {
  if (typeof window === 'undefined') return false
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function isAndroidDevice() {
  if (typeof window === 'undefined') return false
  return /android/i.test(window.navigator.userAgent)
}

function isMobileDevice() {
  if (typeof window === 'undefined') return false
  return /android|iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function isSafariBrowser() {
  if (typeof window === 'undefined') return false

  const ua = window.navigator.userAgent.toLowerCase()

  return (
    ua.includes('safari') &&
    !ua.includes('crios') &&
    !ua.includes('fxios') &&
    !ua.includes('edgios') &&
    !ua.includes('chrome')
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

  const raw = window.localStorage.getItem(DISMISS_KEY)
  if (!raw) return false

  const dismissedAt = Number(raw)
  if (!Number.isFinite(dismissedAt)) return false

  const daysSinceDismiss = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24)
  return daysSinceDismiss < DISMISS_DAYS
}

function rememberDismiss() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
}

function getAndIncreaseVisitCount() {
  if (typeof window === 'undefined') return 1

  const raw = window.localStorage.getItem(VISIT_COUNT_KEY)
  const current = Number(raw)
  const next = Number.isFinite(current) && current > 0 ? current + 1 : 1

  window.localStorage.setItem(VISIT_COUNT_KEY, String(next))
  return next
}

function resetVisitCount() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(VISIT_COUNT_KEY)
}

export default function InstallAppPrompt() {
  const pathname = usePathname()

  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [isIosSafari, setIsIosSafari] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [visitCount, setVisitCount] = useState(1)
  const [showAndroidFallback, setShowAndroidFallback] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    setMounted(true)

    const dismissedRecently = wasDismissedRecently()
    const standalone = isStandaloneMode()
    const iosSafari = isIosDevice() && isSafariBrowser()
    const android = isAndroidDevice()
    const mobile = isMobileDevice()
    const visits = getAndIncreaseVisitCount()

    setDismissed(dismissedRecently)
    setInstalled(standalone)
    setIsIosSafari(iosSafari)
    setIsAndroid(android)
    setIsMobile(mobile)
    setVisitCount(visits)

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      setShowAndroidFallback(false)
    }

    const handleAppInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
      setShowAndroidFallback(false)
      resetVisitCount()
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    const fallbackTimer = window.setTimeout(() => {
      const shouldShowFallback =
        android &&
        mobile &&
        !iosSafari &&
        !standalone &&
        !dismissedRecently &&
        visits >= ANDROID_FALLBACK_MIN_VISITS

      if (shouldShowFallback) {
        setShowAndroidFallback(true)
      }
    }, FALLBACK_DELAY_MS)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      window.clearTimeout(fallbackTimer)
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

  const variant: InstallVariant = useMemo(() => {
    if (isIosSafari) return 'ios'
    if (deferredPrompt) return 'android-install'
    if (showAndroidFallback && isAndroid) return 'android-help'
    return null
  }, [deferredPrompt, isIosSafari, showAndroidFallback, isAndroid])

  const isAllowedRoute = ALLOWED_ROUTES.includes(pathname)

  if (
    !mounted ||
    !isMobile ||
    !isAllowedRoute ||
    installed ||
    dismissed ||
    !variant
  ) {
    return null
  }

  function renderHeader() {
    switch (variant) {
      case 'android-install':
        return (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
              Installera Golfrundan
            </div>
            <div className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>
              Lägg appen på hemskärmen för snabbare åtkomst och en mer app-lik upplevelse.
            </div>
          </>
        )

      case 'android-help':
        return (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
              Problem att installera appen?
            </div>
            <div className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>
              Om du tidigare har installerat appen och tagit bort den kan Chrome
              behöva återställas innan appen går att installera igen.
            </div>
          </>
        )

      case 'ios':
        return (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
              Lägg till Golfrundan på hemskärmen
            </div>
            <div className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>
              Öppna <strong>Dela</strong> i Safari och välj{' '}
              <strong>Lägg till på hemskärmen</strong>.
            </div>
          </>
        )

      default:
        return null
    }
  }

  function renderBody() {
    switch (variant) {
      case 'android-install':
        return (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleInstall}
              className="button"
              style={{ flex: 2, minWidth: 180 }}
            >
              Installera app
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="button secondary"
              style={{ flex: 1, minWidth: 140 }}
            >
              Inte nu
            </button>
          </div>
        )

      case 'android-help':
        return (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowHelp((prev) => !prev)}
                className="button"
                style={{ flex: 2, minWidth: 180 }}
              >
                {showHelp ? 'Dölj hjälp' : 'Visa hur du löser det'}
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="button secondary"
                style={{ flex: 1, minWidth: 140 }}
              >
                Inte nu
              </button>
            </div>

            {showHelp ? (
              <div
                style={{
                  borderRadius: 16,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  padding: 12,
                  fontSize: 14,
                  lineHeight: 1.65,
                  color: '#0f172a',
                }}
              >
                <strong>Gör så här i Chrome:</strong>
                <br />
                1. Öppna sidan i Chrome
                <br />
                2. Öppna <strong>Webbplatsinställningar</strong>
                <br />
                3. Tryck på <strong>Rensa och återställ</strong>
                <br />
                4. Starta om Chrome och försök igen
                <br />
                <br />
                Fungerar det fortfarande inte?
                <br />
                • Rensa Chrome-cache
                <br />
                • Starta om telefonen
              </div>
            ) : null}
          </div>
        )

      case 'ios':
        return (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleDismiss}
              className="button secondary"
              style={{ flex: 1, minWidth: 140 }}
            >
              Okej
            </button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <section
      aria-label="Installera app"
      style={{
        marginTop: 16,
        border: '1px solid #dbe7df',
        background: '#ffffff',
        borderRadius: 20,
        padding: 16,
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
        display: 'grid',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          aria-hidden="true"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            display: 'grid',
            placeItems: 'center',
            background: '#ecfdf3',
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          📲
        </div>

        <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
          {renderHeader()}
        </div>
      </div>

      {renderBody()}
    </section>
  )
}
