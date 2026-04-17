import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  addFeedEventComment,
  likeFeedEvent,
  unlikeFeedEvent,
} from '@/app/dashboard/actions'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'

type FeedEventRow = {
  id: string
  user_id: string
  round_id: string
  event_type: 'birdie' | 'eagle' | 'hole_in_one'
  hole_number: number
  created_at: string
  player_name: string | null
  course_name: string | null
}

type FeedEventLikeRow = {
  id: string
  feed_event_id: string
  user_id: string
}

type FeedEventCommentRow = {
  id: string
  feed_event_id: string
  user_id: string
  body: string
  created_at: string
}

type FriendRow = {
  friend_email: string | null
}

function formatFeedEventTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)

  const sameAsYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()

  const timeText = date.toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (sameDay) return `Idag ${timeText}`
  if (sameAsYesterday) return `Igår ${timeText}`

  return date.toLocaleString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getProfileName(profile?: Profile | null) {
  if (profile?.display_name?.trim()) return profile.display_name.trim()

  if (profile?.email?.trim()) {
    const localPart = profile.email.trim().split('@')[0]
    if (localPart) return localPart
  }

  return 'En spelare'
}

export default async function FeedEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const currentUserEmail = (user.email ?? '').trim().toLowerCase()

  const { data: friendsData } = await supabase
    .from('friends')
    .select('friend_email')
    .eq('user_email', currentUserEmail)
    .eq('status', 'accepted')

  const friendEmails = ((friendsData as FriendRow[] | null) ?? [])
    .map((friend) => friend.friend_email)
    .filter((email): email is string => typeof email === 'string')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0)

  let friendUserIds: string[] = []

  if (friendEmails.length > 0) {
    const { data: friendProfiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('email', friendEmails)

    friendUserIds = (friendProfiles ?? []).map((profile) => profile.id)
  }

  const visibleUserIds = Array.from(new Set([user.id, ...friendUserIds]))

  const { data: eventData, error: eventError } = await supabase
    .from('feed_events')
    .select(
      'id, user_id, round_id, event_type, hole_number, created_at, player_name, course_name'
    )
    .eq('id', id)
    .in('user_id', visibleUserIds)
    .maybeSingle()

  if (eventError) {
    console.error('Failed to load feed event details:', eventError)
  }

  const event = (eventData as FeedEventRow | null) ?? null

  if (!event) {
    notFound()
  }

  const [{ data: likesData }, { data: commentsData }] = await Promise.all([
    supabase
      .from('feed_event_likes')
      .select('id, feed_event_id, user_id')
      .eq('feed_event_id', event.id),
    supabase
      .from('feed_event_comments')
      .select('id, feed_event_id, user_id, body, created_at')
      .eq('feed_event_id', event.id)
      .order('created_at', { ascending: true }),
  ])

  const likes = (likesData as FeedEventLikeRow[] | null) ?? []
  const comments = (commentsData as FeedEventCommentRow[] | null) ?? []

  const profileIds = Array.from(
    new Set([
      event.user_id,
      ...likes.map((like) => like.user_id),
      ...comments.map((comment) => comment.user_id),
    ])
  )

  let profiles: Profile[] = []

  if (profileIds.length > 0) {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .in('id', profileIds)

    if (profileError) {
      console.error('Failed to load feed detail profiles:', profileError)
    }

    profiles = (profileData as Profile[] | null) ?? []
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile] as const))

  const likedByMe = likes.some((like) => like.user_id === user.id)
  const likesCount = likes.length
  const playerName =
    event.player_name?.trim() || getProfileName(profileById.get(event.user_id))
  const courseName = event.course_name?.trim() || 'Okänd bana'

  const eventMeta =
    event.event_type === 'birdie'
      ? { emoji: '🐦', text: 'birdie' }
      : event.event_type === 'eagle'
      ? { emoji: '🦅', text: 'eagle' }
      : { emoji: '🎯', text: 'hole-in-one' }

  return (
    <main>
      <div className="container" style={{ display: 'grid', gap: 16 }}>
        <div className="card" style={{ borderRadius: 24 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h1 className="title" style={{ margin: 0 }}>
                Händelse
              </h1>
              <p className="meta" style={{ marginTop: 8 }}>
                Gilla och kommentera i en renare vy.
              </p>
            </div>

            <Link href="/dashboard#friend-feed" className="button secondary">
              Tillbaka till vänflöde
            </Link>
          </div>
        </div>

        <div className="card" style={{ borderRadius: 22, display: 'grid', gap: 10 }}>
          <div style={{ fontWeight: 900, color: '#1f3327', fontSize: 22 }}>
            {eventMeta.emoji} {playerName} gjorde {eventMeta.text}
          </div>

          <div className="muted">
            Hål {event.hole_number} - {courseName}
          </div>

          <div className="muted" style={{ fontSize: 13 }}>
            {formatFeedEventTime(event.created_at)}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="muted" style={{ fontSize: 13 }}>
              👍 {likesCount}
            </div>

            {likedByMe ? (
              <form action={unlikeFeedEvent}>
                <input type="hidden" name="feedEventId" value={event.id} />
                <button type="submit" className="button secondary">
                  Gillat
                </button>
              </form>
            ) : (
              <form action={likeFeedEvent}>
                <input type="hidden" name="feedEventId" value={event.id} />
                <button type="submit" className="button secondary">
                  Gilla
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="card" style={{ borderRadius: 22, display: 'grid', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 24 }}>Kommentarer</h2>
            <div className="muted">💬 {comments.length}</div>
          </div>

          {comments.length === 0 ? (
            <div className="notice">Ingen kommentar än. Skriv första.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {comments.map((comment) => {
                const author = profileById.get(comment.user_id)
                const authorName = getProfileName(author)
                return (
                  <div
                    key={comment.id}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 10,
                      background: '#f8fafc',
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{authorName}</div>
                    <div style={{ marginTop: 4, color: '#374151' }}>{comment.body}</div>
                  </div>
                )
              })}
            </div>
          )}

          <form action={addFeedEventComment} style={{ display: 'grid', gap: 6 }}>
            <input type="hidden" name="feedEventId" value={event.id} />
            <input
              type="text"
              name="body"
              maxLength={200}
              placeholder="Skriv en kommentar..."
            />
            <button type="submit" className="button secondary">
              Kommentera
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
