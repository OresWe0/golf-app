'use client'

import { useState, useTransition } from 'react'

type MarkReadAction = (formData: FormData) => Promise<void>

export default function NotificationClearButton({
  notificationId,
  markReadAction,
}: {
  notificationId: string
  markReadAction: MarkReadAction
}) {
  const [isHidden, setIsHidden] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (isHidden) return null

  return (
    <form
      action={(formData) => {
        setIsHidden(true)
        startTransition(async () => {
          await markReadAction(formData)
        })
      }}
    >
      <input type="hidden" name="notificationId" value={notificationId} />
      <button
        type="submit"
        className="button secondary"
        style={{ minWidth: 120 }}
        disabled={isPending}
      >
        {isPending ? 'Klar...' : '✓ Klart'}
      </button>
    </form>
  )
}

