import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT=mailto:sigge@dufvander.se,
  process.env.BLEDoaNnCSLz-6MpDCCf7ZMJ2xoLma7Hb0xeG5-vmuJ1JMe10TCcd-nC-oSMOV8cY9C0AENTIEC8YjZaICEAH3I,
  process.env.AOZLRtyKx8Gpwd0uQdTM60tpB_H3WZq-6KqVoipGxqk
)

export async function sendPushNotification(
  subscription: {
    endpoint: string
    p256dh: string
    auth: string
  },
  payload: {
    title: string
    body: string
    url?: string
  }
) {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload)
    )
  } catch (error) {
    console.error('Push error:', error)
  }
}
