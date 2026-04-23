'use client'

import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type HeroNotificationItem = {
  id: string
  title: string
  createdAt: string
  href: string
}

const iconButtonStyle: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 14,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid rgba(255,255,255,0.24)',
  background: 'rgba(12, 35, 24, 0.36)',
  color: '#fff',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 8px 22px rgba(15, 23, 42, 0.2)',
  fontSize: 24,
  lineHeight: 1,
  cursor: 'pointer',
}

const menuItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  justifyContent: 'flex-start',
  width: '100%',
  minHeight: 38,
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.09)',
  color: '#fff',
  fontSize: 14,
  fontWeight: 800,
  textDecoration: 'none',
  boxSizing: 'border-box',
}

export default function DashboardHeroMenu({
  isAdmin,
  pendingCount,
  incomingFriendRequestsCount,
  signOutAction,
  notifications,
}: {
  isAdmin: boolean
  pendingCount: number
  incomingFriendRequestsCount: number
  signOutAction: () => Promise<void>
  notifications: HeroNotificationItem[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isBellOpen, setIsBellOpen] = useState(false)
  const [bellUnreadCount, setBellUnreadCount] = useState(notifications.length)
  const [showHint, setShowHint] = useState(false)
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other')
  const containerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const ua = window.navigator.userAgent || ''
    if (/iPhone|iPad|iPod/i.test(ua)) {
      setPlatform('ios')
      return
    }
    if (/Android/i.test(ua)) {
      setPlatform('android')
      return
    }
    setPlatform('other')
  }, [])

  useEffect(() => {
    const storageKey = 'dashboard_menu_hint_seen_v1'
    try {
      const seen = window.localStorage.getItem(storageKey)
      if (!seen) {
        setShowHint(true)
        const timer = window.setTimeout(() => {
          setShowHint(false)
          window.localStorage.setItem(storageKey, '1')
        }, 4200)
        return () => window.clearTimeout(timer)
      }
    } catch {
      // Ignore localStorage errors in private mode.
    }
  }, [])

  useEffect(() => {
    setBellUnreadCount(notifications.length)
  }, [notifications])

  useEffect(() => {
    if (!isOpen && !isBellOpen) return

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (!containerRef.current?.contains(target)) {
        setIsOpen(false)
        setIsBellOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        setIsBellOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('touchstart', handlePointerDown, { passive: true })
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('touchstart', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, isBellOpen])

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 10 }}
    >
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          aria-label="Öppna notiser"
          aria-expanded={isBellOpen}
          onClick={() => {
            setIsBellOpen((prev) => {
              const next = !prev
              if (next) {
                setBellUnreadCount(0)
              }
              return next
            })
            setIsOpen(false)
          }}
          style={iconButtonStyle}
        >
          🔔
        </button>

        {bellUnreadCount > 0 ? (
          <span
            aria-label={`${bellUnreadCount} olästa notiser`}
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 20,
              height: 20,
              borderRadius: 999,
              background: '#dc2626',
              color: '#fff',
              fontSize: 11,
              fontWeight: 900,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 6px',
              boxShadow: '0 8px 18px rgba(220, 38, 38, 0.26)',
              border: '2px solid #fff',
              pointerEvents: 'none',
            }}
          >
            {bellUnreadCount}
          </span>
        ) : null}

        <div
          style={{
            position: 'absolute',
            top: platform === 'ios' ? 58 : 56,
            right: 0,
            width: 'min(86vw, 320px)',
            zIndex: 20,
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.24)',
            background: 'rgba(12, 35, 24, 0.96)',
            backdropFilter: 'blur(10px)',
            boxShadow: isBellOpen
              ? '0 18px 36px rgba(15, 23, 42, 0.35)'
              : '0 0 0 rgba(15, 23, 42, 0)',
            padding: 8,
            display: 'grid',
            gap: 6,
            opacity: isBellOpen ? 1 : 0,
            transform: isBellOpen ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.98)',
            transformOrigin: 'top right',
            pointerEvents: isBellOpen ? 'auto' : 'none',
            transition:
              'opacity 180ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms ease',
          }}
        >
          <div style={{ color: '#fff', fontSize: 13, fontWeight: 900, padding: '4px 4px 6px' }}>
            Notiser
          </div>
          {notifications.length === 0 ? (
            <div
              style={{
                color: 'rgba(255,255,255,0.78)',
                fontSize: 13,
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.16)',
                background: 'rgba(255,255,255,0.06)',
                padding: 10,
              }}
            >
              Inga nya notiser just nu.
            </div>
          ) : (
            notifications.map((notification) => (
              <Link
                key={notification.id}
                href={notification.href}
                onClick={() => setIsBellOpen(false)}
                style={{
                  textDecoration: 'none',
                  color: '#fff',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.16)',
                  background: 'rgba(255,255,255,0.07)',
                  padding: 10,
                  display: 'grid',
                  gap: 4,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.35 }}>
                  {notification.title}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                  {notification.createdAt}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      <button
        type="button"
        aria-label="Öppna meny"
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen((prev) => !prev)
          setIsBellOpen(false)
        }}
        style={{
          ...iconButtonStyle,
          animation: showHint ? 'dashboardMenuPulse 1s ease-in-out 7' : undefined,
          boxShadow: showHint
            ? '0 0 0 2px rgba(34, 197, 94, 0.65), 0 12px 26px rgba(34, 197, 94, 0.28)'
            : iconButtonStyle.boxShadow,
        }}
      >
        ☰
      </button>

      {showHint ? (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: platform === 'ios' ? 8 : platform === 'android' ? 2 : 4,
            right: platform === 'ios' ? 60 : platform === 'android' ? 54 : 56,
            padding: '6px 10px',
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.24)',
            background: 'rgba(12, 35, 24, 0.88)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 800,
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 10px 20px rgba(15, 23, 42, 0.25)',
            animation: 'dashboardMenuHintFade 4.2s ease forwards',
            pointerEvents: 'none',
          }}
        >
          Meny
        </div>
      ) : null}

      {incomingFriendRequestsCount > 0 ? (
        <span
          aria-label={`${incomingFriendRequestsCount} inkommande vänförfrågningar`}
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 20,
            height: 20,
            borderRadius: 999,
            background: '#dc2626',
            color: '#fff',
            fontSize: 11,
            fontWeight: 900,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 6px',
            boxShadow: '0 8px 18px rgba(220, 38, 38, 0.26)',
            border: '2px solid #fff',
            pointerEvents: 'none',
          }}
        >
          {incomingFriendRequestsCount}
        </span>
      ) : null}

      <div
        style={{
          position: 'absolute',
          top: platform === 'ios' ? 58 : 56,
          right: 0,
          minWidth: 186,
          zIndex: 20,
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.24)',
          background: 'rgba(12, 35, 24, 0.96)',
          backdropFilter: 'blur(10px)',
          boxShadow: isOpen
            ? '0 18px 36px rgba(15, 23, 42, 0.35)'
            : '0 0 0 rgba(15, 23, 42, 0)',
          padding: 8,
          display: 'grid',
          gap: 6,
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.98)',
          transformOrigin: 'top right',
          pointerEvents: isOpen ? 'auto' : 'none',
          transition:
            'opacity 180ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms ease',
        }}
      >
        {isAdmin ? (
          <Link href="/admin/users" style={menuItemStyle} onClick={() => setIsOpen(false)}>
            Admin{pendingCount > 0 ? ` ${pendingCount}` : ''}
          </Link>
        ) : null}

        <Link href="/profile" style={menuItemStyle} onClick={() => setIsOpen(false)}>
          Profil
        </Link>

        <Link href="/statistik" style={menuItemStyle} onClick={() => setIsOpen(false)}>
          Statistik
        </Link>

        <form action={signOutAction}>
          <button type="submit" style={{ ...menuItemStyle, cursor: 'pointer' }}>
            Logga ut
          </button>
        </form>
      </div>

      <style jsx>{`
        @keyframes dashboardMenuPulse {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.08);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes dashboardMenuHintFade {
          0% {
            opacity: 0;
            transform: translateX(6px) scale(0.96);
          }
          15% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
          80% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateX(2px) scale(0.98);
          }
        }
      `}</style>
    </div>
  )
}

