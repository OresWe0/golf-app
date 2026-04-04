'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { receivedStrokesOnHole } from '@/lib/scoring'

export function HolePlay({
  roundId,
  currentHole,
  totalHoles,
  startHole,
  endHole,
  hole,
  players,
  scores,
}: any) {
  const router = useRouter()

  const touchStartX = useRef<number | null>(null)
  const firstPlayerCardRef = useRef<HTMLDivElement | null>(null)
  const hasUserChangedScoreRef = useRef(false)
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const createValuesFromScores = () =>
    Object.fromEntries(
      players.map((player: any) => {
        const existing = scores.find((score: any) => score.round_player_id === player.id)
        return [String(player.id), existing?.strokes?.toString() ?? '']
      })
    )

  const createEmptyValues = () =>
    Object.fromEntries(players.map((player: any) => [String(player.id), '']))

  const [values, setValues] = useState<Record<string, string>>(createValuesFromScores())
  const [loading, setLoading] = useState(false)
  const [showHoleImage, setShowHoleImage] = useState(false)
  const [holeImageError, setHoleImageError] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [previewHoleNumber, setPreviewHoleNumber] = useState<number>(hole.hole_number)

  const allPlayersHaveScores = (candidateValues: Record<string, string>) => {
    if (!players?.length) return false

    return players.every((player: any) => {
      const value = candidateValues[String(player.id)]
      return value !== '' && value !== undefined && value !== null
    })
  }

  useEffect(() => {
    setValues(createValuesFromScores())
    setPreviewHoleNumber(hole.hole_number)
    setHoleImageError(false)
    hasUserChangedScoreRef.current = false

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
      autoSaveTimeoutRef.current = null
    }

    setTimeout(() => {
      firstPlayerCardRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 80)
  }, [hole.hole_number, scores])

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!hasUserChangedScoreRef.current) return
    if (loading) return
    if (!allPlayersHaveScores(values)) return

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      saveScores(values)
    }, 300)

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [values, loading, players])

  const quickScores = useMemo(() => {
    const base = [1, 2, 3, 4, 5, 6, 7, 8]
    const extra = hole.par + 4
    return Array.from(new Set([...base, extra])).sort((a, b) => a - b)
  }, [hole.par])

  const holeImageSrc = `/course-images/karsta/${previewHoleNumber}.jpg`

  const goPrevious = () => {
    const target =
      currentHole > startHole
        ? `/rounds/${roundId}?hole=${currentHole - 1}`
        : '/dashboard'
    router.push(target)
  }

  const goNext = () => {
    const target =
      currentHole === endHole
        ? `/rounds/${roundId}/summary`
        : `/rounds/${roundId}?hole=${currentHole + 1}`
    router.push(target)
  }

  const saveScores = async (overrideValues?: Record<string, string>) => {
    const valuesToSave = overrideValues ?? values
    if (loading) return
    if (!allPlayersHaveScores(valuesToSave)) return

    setLoading(true)

    const response = await fetch(`/api/rounds/${roundId}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        holeNumber: currentHole,
        scores: players.map((player: any) => ({
          roundPlayerId: player.id,
          strokes: valuesToSave[String(player.id)]
            ? Number(valuesToSave[String(player.id)])
            : null,
        })),
      }),
    })

    if (!response.ok) {
      setLoading(false)
      alert('Det gick inte att spara score. Prova igen.')
      return
    }

    setSavedFlash(true)
    setValues(createEmptyValues())
    hasUserChangedScoreRef.current = false

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([25, 20, 25])
    }

    setTimeout(() => {
      const target =
        currentHole === endHole
          ? `/rounds/${roundId}/summary`
          : `/rounds/${roundId}?hole=${currentHole + 1}`
      router.push(target)
    }, 260)
  }

  const setScore = (playerId: string, score: number) => {
    if (typeof window !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10)
    }
    hasUserChangedScoreRef.current = true
    setValues((prev) => ({
      ...prev,
      [String(playerId)]: String(score),
    }))
  }

  const getLabel = (diff: number) => {
    if (diff === 0) return 'Par'
    if (diff === -1) return 'Birdie'
    if (diff === -2) return 'Eagle'
    if (diff === 1) return 'Bogey'
    if (diff >= 2) return 'Double+'
    return ''
  }

  const openHoleImage = () => {
    setPreviewHoleNumber(hole.hole_number)
    setHoleImageError(false)
    setShowHoleImage(true)
  }

  const closeHoleImage = () => {
    setShowHoleImage(false)
  }

  const previewPreviousHole = () => {
    if (previewHoleNumber > startHole) {
      setPreviewHoleNumber((prev: number) => prev - 1)
      setHoleImageError(false)
    }
  }

  const previewNextHole = () => {
    if (previewHoleNumber < endHole) {
      setPreviewHoleNumber((prev: number) => prev + 1)
      setHoleImageError(false)
    }
  }

  const onTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null
  }

  const onTouchEnd: React.TouchEventHandler<HTMLDivElement> = (e) => {
    const startX = touchStartX.current
    const endX = e.changedTouches[0]?.clientX ?? null
    if (startX == null || endX == null) return
    const diff = endX - startX
    if (showHoleImage) {
      if (diff > 70 && previewHoleNumber > startHole) {
        previewPreviousHole()
      }
      if (diff < -70 && previewHoleNumber < endHole) {
        previewNextHole()
      }
      touchStartX.current = null
      return
    }
    if (diff > 70 && currentHole > startHole) {
      goPrevious()
    }
    if (diff < -70 && currentHole < endHole) {
      goNext()
    }
    touchStartX.current = null
  }

  useEffect(() => {
    if (!showHoleImage) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeHoleImage()
      if (e.key === 'ArrowLeft' && previewHoleNumber > startHole) previewPreviousHole()
      if (e.key === 'ArrowRight' && previewHoleNumber < endHole) previewNextHole()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showHoleImage, previewHoleNumber, startHole, endHole])

  return (
    <div
      style={{ paddingBottom: 120 }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* resten av din JSX oförändrad: här renderar du spelarnamn, knappar för quickScores
          och knappar för att navigera mellan hål samt eventuellt en save-knapp. */}
    </div>
  )
}