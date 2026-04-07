import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Inte inloggad.' }, { status: 401 })
  }

  // 🔎 Hämta rundan
  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('id, owner_id, status')
    .eq('id', id)
    .single()

  if (roundError || !round) {
    return NextResponse.json({ error: 'Rundan hittades inte.' }, { status: 404 })
  }

  // 🔐 Säkerhet: bara ägare får avsluta (du kan ändra detta om fler ska få)
  if (round.owner_id !== user.id) {
    return NextResponse.json(
      { error: 'Du har inte behörighet att avsluta denna runda.' },
      { status: 403 }
    )
  }

  // 🧠 Om redan avslutad → returnera OK istället för fel
  if (round.status === 'completed') {
    return NextResponse.json({ ok: true, alreadyCompleted: true })
  }

  // ✅ Uppdatera status
  const { error: updateError } = await supabase
    .from('rounds')
    .update({
      status: 'completed',
    })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}