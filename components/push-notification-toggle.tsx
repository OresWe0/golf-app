'use client'

import { useState, useTransition } from 'react'
import {
  registerPushSubscription,
  unregisterPushSubscription,
} from '@/lib/push'
import {
  savePushSubscription,
  deletePushSubscription,
  setPushFriendActivityEnabled,
} from '@/app/profile/actions'

export default function PushNotificationToggle({
  initialEnabled,
}: {
  initialEnabled: boolean
}) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    setMessage('')

    startTransition(async () => {
      try {
        if (!enabled) {
          const subscription = await registerPushSubscription()
          const saveResult = await savePushSubscription(subscription)

          if (!saveResult.ok) {
            throw new Error(saveResult.error || 'Kunde inte spara subscription.')
          }

          const toggleResult = await setPushFriendActivityEnabled(true)

          if (!toggleResult.ok) {
            throw new Error(toggleResult.error || 'Kunde inte spara inställningen.')
          }

          setEnabled(true)
          setMessage('Pushnotiser är nu aktiverade.')
        } else {
          const subscription = await unregisterPushSubscription()

          if (subscription?.endpoint) {
            const deleteResult = await deletePushSubscription(subscription.endpoint)

            if (!deleteResult.ok) {
              throw new Error(deleteResult.error || 'Kunde inte ta bort subscription.')
            }
          }

          const toggleResult = await setPushFriendActivityEnabled(false)

          if (!toggleResult.ok) {
            throw new Error(toggleResult.error || 'Kunde inte spara inställningen.')
          }

          setEnabled(false)
          setMessage('Pushnotiser är nu avstängda.')
        }
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : 'Något gick fel.'
        )
      }
    })
  }

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        padding: 16,
        background: '#fff',
        display: 'grid',
        gap: 10,
      }}
    >
      <div>
        <div style={{ fontWeight: 800, color: '#1f3327' }}>
          Pushnotiser om vänners aktivitet
        </div>
        <div className="muted" style={{ marginTop: 4 }}>
          Få notiser när dina vänner är ute på banan eller gör birdie, eagle
          eller hole-in-one.
        </div>
      </div>

      <button
        type="button"
        className="button secondary"
        onClick={handleToggle}
        disabled={isPending}
        style={{ maxWidth: 260 }}
      >
        {isPending
          ? 'Sparar...'
          : enabled
            ? 'Stäng av pushnotiser'
            : 'Aktivera pushnotiser'}
      </button>

      {message ? (
        <div className="muted" style={{ fontSize: 14 }}>
          {message}
        </div>
      ) : null}
    </div>
  )
}