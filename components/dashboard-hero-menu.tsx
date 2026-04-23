'use client'

import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

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
}: {
  isAdmin: boolean
  pendingCount: number
  incomingFriendRequestsCount: number
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const storageKey = 'dashboard_menu_hint_seen_v1'
    try {
      const seen = window.localStorage.getItem(storageKey)
      if (!seen) {
        setShowHint(true)
        const timer = window.setTimeout(() => {
          setShowHint(false)
          window.localStorage.setItem(storageKey, '1')
        }, 2200)
        return () => window.clearTimeout(timer)
      }
    } catch {
      // Ignore localStorage errors in private mode.
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (!containerRef.current?.contains(target)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('touchstart', handlePointerDown, { passive: true })
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('touchstart', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="Oppna meny"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          ...iconButtonStyle,
          animation: showHint ? 'dashboardMenuPulse 1s ease-in-out 4' : undefined,
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
            top: 4,
            right: 56,
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
            animation: 'dashboardMenuHintFade 2.2s ease forwards',
            pointerEvents: 'none',
          }}
        >
          Meny
        </div>
      ) : null}

      {incomingFriendRequestsCount > 0 ? (
        <span
          aria-label={`${incomingFriendRequestsCount} inkommande vanforfraganingar`}
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

      {isOpen ? (
        <div
          style={{
            position: 'absolute',
            top: 56,
            right: 0,
            minWidth: 186,
            zIndex: 20,
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.24)',
            background: 'rgba(12, 35, 24, 0.96)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 18px 36px rgba(15, 23, 42, 0.35)',
            padding: 8,
            display: 'grid',
            gap: 6,
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

          <Link href="/logout" style={menuItemStyle} onClick={() => setIsOpen(false)}>
            Logga ut
          </Link>
        </div>
      ) : null}

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
