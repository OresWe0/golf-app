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
  sendTestPushNotification,
} from '@/app/profile/actions'

export default function PushNotificationToggle({
  initialEnabled,
}: {
  initialEnabled: boolean
}) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()
  const [isTestPending, startTestTransition] = useTransition()

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
        setMessage(error instanceof Error ? error.message : 'Något gick fel.')
      }
    })
  }

  function handleSendTestPush() {
    setMessage('')

    startTestTransition(async () => {
      const result = await sendTestPushNotification()

      if (!result.ok) {
        setMessage(result.error || 'Kunde inte skicka testnotis.')
        return
      }

      setMessage('Testnotis skickad. Kontrollera att den kommer fram.')
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
          Push för vänaktivitet
        </div>
        <div className="muted" style={{ marginTop: 4 }}>
          Aktivera pushnotiser och testa att allt fungerar.
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          className="button secondary"
          onClick={handleToggle}
          disabled={isPending || isTestPending}
          style={{ maxWidth: 260 }}
        >
          {isPending
            ? 'Sparar...'
            : enabled
              ? 'Stäng av pushnotiser'
              : 'Aktivera pushnotiser'}
        </button>

        <button
          type="button"
          className="button secondary"
          onClick={handleSendTestPush}
          disabled={!enabled || isPending || isTestPending}
          style={{ maxWidth: 220 }}
        >
          {isTestPending ? 'Skickar test...' : 'Skicka testnotis'}
        </button>
      </div>

      {message ? (
        <div className="muted" style={{ fontSize: 14 }}>
          {message}
        </div>
      ) : null}
    </div>
  )
}
