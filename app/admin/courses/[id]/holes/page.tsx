import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type SearchParams = Promise<{
  message?: string
  type?: 'success' | 'warning' | 'error'
}>

type Params = Promise<{ id: string }>

type HoleRow = {
  hole_number: number
  par: number
  hcp_index: number
  length_yellow: number
  length_red: number
}

type TeeRow = {
  id: string
  tee_key: string
  slope_rating: number | null
  course_rating: number | null
  par_total: number | null
}

type GpsRow = {
  hole_number: number
  front_lat: number
  front_lng: number
  center_lat: number
  center_lng: number
  back_lat: number
  back_lng: number
}

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: me, error } = await supabase
    .from('profiles')
    .select('id, is_admin')
    .eq('id', user.id)
    .single()

  if (error || !me?.is_admin) notFound()

  return supabase
}

function toNumber(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function parseBulkHoles(text: string) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const parsed: HoleRow[] = []

  for (const line of rows) {
    const normalized = line.replace(/\s+/g, ' ').trim()
    const parts = normalized.split(/[\t,; ]+/).filter(Boolean)
    if (parts.length < 5) continue

    const maybeHeader = parts[0].toLowerCase()
    if (maybeHeader === 'hole' || maybeHeader === 'hal' || maybeHeader === 'hål') {
      continue
    }

    const holeNumber = toNumber(parts[0])
    const par = toNumber(parts[1])
    const hcpIndex = toNumber(parts[2])
    const yellow = toNumber(parts[3])
    const red = toNumber(parts[4])

    if (
      holeNumber == null ||
      par == null ||
      hcpIndex == null ||
      yellow == null ||
      red == null
    ) {
      continue
    }

    parsed.push({
      hole_number: Math.floor(holeNumber),
      par: Math.floor(par),
      hcp_index: Math.floor(hcpIndex),
      length_yellow: Math.floor(yellow),
      length_red: Math.floor(red),
    })
  }

  return parsed.filter((row) => row.hole_number >= 1 && row.hole_number <= 18)
}

function parseBulkGps(text: string) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const parsed: GpsRow[] = []

  for (const line of rows) {
    const normalized = line.replace(/\s+/g, ' ').trim()
    const parts = normalized.split(/[\t,; ]+/).filter(Boolean)
    if (parts.length < 7) continue

    const maybeHeader = parts[0].toLowerCase()
    if (maybeHeader === 'hole' || maybeHeader === 'hal' || maybeHeader === 'hål') {
      continue
    }

    const holeNumber = toNumber(parts[0])
    const frontLat = toNumber(parts[1])
    const frontLng = toNumber(parts[2])
    const centerLat = toNumber(parts[3])
    const centerLng = toNumber(parts[4])
    const backLat = toNumber(parts[5])
    const backLng = toNumber(parts[6])

    if (
      holeNumber == null ||
      frontLat == null ||
      frontLng == null ||
      centerLat == null ||
      centerLng == null ||
      backLat == null ||
      backLng == null
    ) {
      continue
    }

    parsed.push({
      hole_number: Math.floor(holeNumber),
      front_lat: frontLat,
      front_lng: frontLng,
      center_lat: centerLat,
      center_lng: centerLng,
      back_lat: backLat,
      back_lng: backLng,
    })
  }

  return parsed.filter((row) => row.hole_number >= 1 && row.hole_number <= 18)
}

export default async function AdminCourseHolesPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const supabase = await requireAdmin()

  async function saveTeeSettings(formData: FormData) {
    'use server'

    const supabase = await requireAdmin()
    const courseId = String(formData.get('courseId') ?? '')
    const teeKey = String(formData.get('teeKey') ?? '').trim().toLowerCase()
    const slopeRating = toNumber(formData.get('slopeRating'))
    const courseRating = toNumber(formData.get('courseRating'))
    const parTotal = toNumber(formData.get('parTotal'))

    if (!courseId || !teeKey) {
      redirect(
        `/admin/courses/${courseId}/holes?type=error&message=${encodeURIComponent(
          'Saknar courseId eller teeKey'
        )}`
      )
    }

    const { data: existing } = await supabase
      .from('course_tees')
      .select('id')
      .eq('course_id', courseId)
      .eq('tee_key', teeKey)
      .maybeSingle()

    if (existing?.id) {
      const { error } = await supabase
        .from('course_tees')
        .update({
          slope_rating: slopeRating == null ? null : Math.floor(slopeRating),
          course_rating: courseRating,
          par_total: parTotal == null ? null : Math.floor(parTotal),
        })
        .eq('id', existing.id)

      if (error) {
        redirect(
          `/admin/courses/${courseId}/holes?type=error&message=${encodeURIComponent(
            `Kunde inte spara tee: ${error.message}`
          )}`
        )
      }
    } else {
      const { error } = await supabase.from('course_tees').insert({
        course_id: courseId,
        tee_key: teeKey,
        slope_rating: slopeRating == null ? null : Math.floor(slopeRating),
        course_rating: courseRating,
        par_total: parTotal == null ? null : Math.floor(parTotal),
      })

      if (error) {
        redirect(
          `/admin/courses/${courseId}/holes?type=error&message=${encodeURIComponent(
            `Kunde inte skapa tee: ${error.message}`
          )}`
        )
      }
    }

    revalidatePath(`/admin/courses/${courseId}/holes`)
    redirect(`/admin/courses/${courseId}/holes?type=success&message=Tee+sparad`)
  }

  async function bulkUpsertHoles(formData: FormData) {
    'use server'

    const supabase = await requireAdmin()
    const courseId = String(formData.get('courseId') ?? '')
    const raw = String(formData.get('holesText') ?? '')
    const holes = parseBulkHoles(raw)

    if (!courseId) {
      redirect('/admin/courses?type=error&message=Saknar+courseId')
    }

    if (!holes.length) {
      redirect(
        `/admin/courses/${courseId}/holes?type=error&message=${encodeURIComponent(
          'Inga giltiga holes-rader hittades'
        )}`
      )
    }

    const payload = holes.map((hole) => ({
      course_id: courseId,
      hole_number: hole.hole_number,
      par: hole.par,
      hcp_index: hole.hcp_index,
      length_yellow: hole.length_yellow,
      length_red: hole.length_red,
    }))

    const { error } = await supabase
      .from('course_holes')
      .upsert(payload, { onConflict: 'course_id,hole_number' })

    if (error) {
      redirect(
        `/admin/courses/${courseId}/holes?type=error&message=${encodeURIComponent(
          `Kunde inte spara holes: ${error.message}`
        )}`
      )
    }

    revalidatePath(`/admin/courses/${courseId}/holes`)
    revalidatePath('/rounds/new')
    redirect(
      `/admin/courses/${courseId}/holes?type=success&message=${encodeURIComponent(
        `${holes.length} holes sparade`
      )}`
    )
  }

  async function bulkUpsertGps(formData: FormData) {
    'use server'

    const supabase = await requireAdmin()
    const courseId = String(formData.get('courseId') ?? '')
    const raw = String(formData.get('gpsText') ?? '')
    const gpsRows = parseBulkGps(raw)

    if (!courseId) {
      redirect('/admin/courses?type=error&message=Saknar+courseId')
    }

    if (!gpsRows.length) {
      redirect(
        `/admin/courses/${courseId}/holes?type=error&message=${encodeURIComponent(
          'Inga giltiga GPS-rader hittades'
        )}`
      )
    }

    const payload = gpsRows.map((row) => ({
      course_id: courseId,
      hole_number: row.hole_number,
      front_lat: row.front_lat,
      front_lng: row.front_lng,
      center_lat: row.center_lat,
      center_lng: row.center_lng,
      back_lat: row.back_lat,
      back_lng: row.back_lng,
    }))

    const { error } = await supabase
      .from('course_hole_gps')
      .upsert(payload, { onConflict: 'course_id,hole_number' })

    if (error) {
      redirect(
        `/admin/courses/${courseId}/holes?type=error&message=${encodeURIComponent(
          `Kunde inte spara GPS: ${error.message}`
        )}`
      )
    }

    revalidatePath(`/admin/courses/${courseId}/holes`)
    redirect(
      `/admin/courses/${courseId}/holes?type=success&message=${encodeURIComponent(
        `${gpsRows.length} GPS-rader sparade`
      )}`
    )
  }

  const [{ data: courseData }, { data: holesData }, { data: teesData }, { data: gpsData }] =
    await Promise.all([
      supabase.from('courses').select('id, name').eq('id', id).single(),
      supabase
        .from('course_holes')
        .select('hole_number, par, hcp_index, length_yellow, length_red')
        .eq('course_id', id)
        .order('hole_number', { ascending: true }),
      supabase
        .from('course_tees')
        .select('id, tee_key, slope_rating, course_rating, par_total')
        .eq('course_id', id)
        .order('tee_key', { ascending: true }),
      supabase
        .from('course_hole_gps')
        .select(
          'hole_number, front_lat, front_lng, center_lat, center_lng, back_lat, back_lng'
        )
        .eq('course_id', id)
        .order('hole_number', { ascending: true }),
    ])

  if (!courseData) notFound()

  const holes = (holesData ?? []) as HoleRow[]
  const tees = (teesData ?? []) as TeeRow[]
  const gpsRows = (gpsData ?? []) as GpsRow[]
  const yellow = tees.find((tee) => tee.tee_key === 'yellow') ?? null
  const red = tees.find((tee) => tee.tee_key === 'red') ?? null

  const flashType = query.type ?? 'success'
  const flashStyles =
    flashType === 'success'
      ? { border: '#bbf7d0', bg: '#f0fdf4', text: '#166534' }
      : flashType === 'warning'
      ? { border: '#fde68a', bg: '#fffbeb', text: '#92400e' }
      : { border: '#fecaca', bg: '#fef2f2', text: '#991b1b' }

  return (
    <main>
      <div className="container" style={{ display: 'grid', gap: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
          >
            <div>
              <span className="badge">Admin</span>
              <h1 style={{ marginTop: 12, marginBottom: 8 }}>{courseData.name}</h1>
              <p className="muted" style={{ margin: 0 }}>
                Hantera holes, tee-installningar och GPS.
              </p>
            </div>
            <Link href="/admin/courses" className="button secondary">
              Till banlista
            </Link>
          </div>
        </div>

        {query.message ? (
          <div
            className="card"
            style={{
              padding: 14,
              border: `1px solid ${flashStyles.border}`,
              background: flashStyles.bg,
              color: flashStyles.text,
              fontWeight: 700,
            }}
          >
            {query.message}
          </div>
        ) : null}

        <div className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0 }}>Bulk holes (CSV / tab)</h2>
          <p className="muted" style={{ margin: 0 }}>
            Format: hole, par, hcp, yellow, red (en rad per hal).
          </p>
          <form action={bulkUpsertHoles} style={{ display: 'grid', gap: 10 }}>
            <input type="hidden" name="courseId" value={id} />
            <textarea
              name="holesText"
              rows={8}
              placeholder={`1,3,7,152,124
2,4,11,328,281
3,4,3,330,280`}
              style={{
                width: '100%',
                borderRadius: 12,
                border: '1px solid #d1d5db',
                padding: 12,
                boxSizing: 'border-box',
                fontFamily: 'monospace',
              }}
            />
            <button type="submit" className="button">
              Spara holes
            </button>
          </form>
        </div>

        <div className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0 }}>Bulk GPS (CSV / tab)</h2>
          <p className="muted" style={{ margin: 0 }}>
            Format: hole, front_lat, front_lng, center_lat, center_lng, back_lat, back_lng.
          </p>
          <form action={bulkUpsertGps} style={{ display: 'grid', gap: 10 }}>
            <input type="hidden" name="courseId" value={id} />
            <textarea
              name="gpsText"
              rows={8}
              placeholder={`1,59.5834879,15.2484627,59.5834454,15.2483077,59.5833536,15.2481687
2,59.5815968,15.2486891,59.5816722,15.2489027,59.5817664,15.2490388`}
              style={{
                width: '100%',
                borderRadius: 12,
                border: '1px solid #d1d5db',
                padding: 12,
                boxSizing: 'border-box',
                fontFamily: 'monospace',
              }}
            />
            <button type="submit" className="button">
              Spara GPS
            </button>
          </form>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          }}
        >
          <div className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
            <h2 style={{ margin: 0 }}>Yellow tee</h2>
            <form action={saveTeeSettings} style={{ display: 'grid', gap: 10 }}>
              <input type="hidden" name="courseId" value={id} />
              <input type="hidden" name="teeKey" value="yellow" />
              <input
                name="courseRating"
                type="number"
                step="0.1"
                placeholder="Course rating"
                defaultValue={yellow?.course_rating ?? ''}
                style={{
                  minHeight: 44,
                  borderRadius: 12,
                  border: '1px solid #d1d5db',
                  padding: '0 12px',
                }}
              />
              <input
                name="slopeRating"
                type="number"
                step="1"
                placeholder="Slope rating"
                defaultValue={yellow?.slope_rating ?? ''}
                style={{
                  minHeight: 44,
                  borderRadius: 12,
                  border: '1px solid #d1d5db',
                  padding: '0 12px',
                }}
              />
              <input
                name="parTotal"
                type="number"
                step="1"
                placeholder="Par total"
                defaultValue={yellow?.par_total ?? ''}
                style={{
                  minHeight: 44,
                  borderRadius: 12,
                  border: '1px solid #d1d5db',
                  padding: '0 12px',
                }}
              />
              <button type="submit" className="button">
                Spara yellow
              </button>
            </form>
          </div>

          <div className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
            <h2 style={{ margin: 0 }}>Red tee</h2>
            <form action={saveTeeSettings} style={{ display: 'grid', gap: 10 }}>
              <input type="hidden" name="courseId" value={id} />
              <input type="hidden" name="teeKey" value="red" />
              <input
                name="courseRating"
                type="number"
                step="0.1"
                placeholder="Course rating"
                defaultValue={red?.course_rating ?? ''}
                style={{
                  minHeight: 44,
                  borderRadius: 12,
                  border: '1px solid #d1d5db',
                  padding: '0 12px',
                }}
              />
              <input
                name="slopeRating"
                type="number"
                step="1"
                placeholder="Slope rating"
                defaultValue={red?.slope_rating ?? ''}
                style={{
                  minHeight: 44,
                  borderRadius: 12,
                  border: '1px solid #d1d5db',
                  padding: '0 12px',
                }}
              />
              <input
                name="parTotal"
                type="number"
                step="1"
                placeholder="Par total"
                defaultValue={red?.par_total ?? ''}
                style={{
                  minHeight: 44,
                  borderRadius: 12,
                  border: '1px solid #d1d5db',
                  padding: '0 12px',
                }}
              />
              <button type="submit" className="button">
                Spara red
              </button>
            </form>
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12,
              flexWrap: 'wrap',
            }}
          >
            <h2 style={{ margin: 0 }}>Holes ({holes.length})</h2>
            <div className="muted">Visar sparad data</div>
          </div>

          {holes.length === 0 ? (
            <div className="muted">Inga holes sparade annu.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
                <thead>
                  <tr>
                    {['Hole', 'Par', 'HCP', 'Yellow', 'Red'].map((head) => (
                      <th
                        key={head}
                        style={{
                          textAlign: 'left',
                          borderBottom: '1px solid #e5e7eb',
                          padding: '8px 6px',
                          fontSize: 13,
                          color: '#6b7280',
                        }}
                      >
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {holes.map((hole) => (
                    <tr key={hole.hole_number}>
                      <td
                        style={{
                          padding: '9px 6px',
                          borderBottom: '1px solid #f3f4f6',
                          fontWeight: 800,
                        }}
                      >
                        {hole.hole_number}
                      </td>
                      <td style={{ padding: '9px 6px', borderBottom: '1px solid #f3f4f6' }}>
                        {hole.par}
                      </td>
                      <td style={{ padding: '9px 6px', borderBottom: '1px solid #f3f4f6' }}>
                        {hole.hcp_index}
                      </td>
                      <td style={{ padding: '9px 6px', borderBottom: '1px solid #f3f4f6' }}>
                        {hole.length_yellow}
                      </td>
                      <td style={{ padding: '9px 6px', borderBottom: '1px solid #f3f4f6' }}>
                        {hole.length_red}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12,
              flexWrap: 'wrap',
            }}
          >
            <h2 style={{ margin: 0 }}>GPS ({gpsRows.length})</h2>
            <div className="muted">Front / Center / Back per hal</div>
          </div>

          {gpsRows.length === 0 ? (
            <div className="muted">Inga GPS-rader sparade annu.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
                <thead>
                  <tr>
                    {[
                      'Hole',
                      'Front lat',
                      'Front lng',
                      'Center lat',
                      'Center lng',
                      'Back lat',
                      'Back lng',
                    ].map((head) => (
                      <th
                        key={head}
                        style={{
                          textAlign: 'left',
                          borderBottom: '1px solid #e5e7eb',
                          padding: '8px 6px',
                          fontSize: 13,
                          color: '#6b7280',
                        }}
                      >
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gpsRows.map((gps) => (
                    <tr key={gps.hole_number}>
                      <td
                        style={{
                          padding: '9px 6px',
                          borderBottom: '1px solid #f3f4f6',
                          fontWeight: 800,
                        }}
                      >
                        {gps.hole_number}
                      </td>
                      <td style={{ padding: '9px 6px', borderBottom: '1px solid #f3f4f6' }}>
                        {gps.front_lat}
                      </td>
                      <td style={{ padding: '9px 6px', borderBottom: '1px solid #f3f4f6' }}>
                        {gps.front_lng}
                      </td>
                      <td style={{ padding: '9px 6px', borderBottom: '1px solid #f3f4f6' }}>
                        {gps.center_lat}
                      </td>
                      <td style={{ padding: '9px 6px', borderBottom: '1px solid #f3f4f6' }}>
                        {gps.center_lng}
                      </td>
                      <td style={{ padding: '9px 6px', borderBottom: '1px solid #f3f4f6' }}>
                        {gps.back_lat}
                      </td>
                      <td style={{ padding: '9px 6px', borderBottom: '1px solid #f3f4f6' }}>
                        {gps.back_lng}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
