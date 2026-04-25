import Link from 'next/link'
import type { CSSProperties } from 'react'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type SearchParams = Promise<{
  message?: string
  type?: 'success' | 'warning' | 'error'
}>

type CourseRow = {
  id: string
  name: string
  club_name: string | null
}

type ImportedHole = {
  hole_number: number
  par: number
  hcp_index: number
  length_yellow: number
  length_red: number
}

type ImportedTee = {
  tee_key: string
  label?: string
  course_rating: number | null
  slope_rating: number | null
  par_total: number | null
}

type ImportedCoursePayload = {
  name?: string
  courseName?: string
  club_name?: string
  clubName?: string
  holes?: Partial<ImportedHole>[]
  tees?: Partial<ImportedTee>[]
}

type ParsedCourse = {
  name: string
  club_name: string
  holes: ImportedHole[]
  tees: ImportedTee[]
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

function fail(path: string, type: 'success' | 'warning' | 'error', message: string): never {
  redirect(`${path}?type=${type}&message=${encodeURIComponent(message)}`)
}

function text(value: unknown) {
  return String(value ?? '').trim()
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function teeKey(value: unknown) {
  const key = text(value).toLowerCase()
  if (key === 'gul') return 'yellow'
  if (key === 'röd' || key === 'rod') return 'red'
  return key
}

function requireUniqueNumbers(values: number[], label: string) {
  const seen = new Set<number>()
  const duplicates = new Set<number>()

  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }

  if (duplicates.size > 0) {
    throw new Error(`${label} innehåller dubbletter: ${Array.from(duplicates).join(', ')}.`)
  }
}

function requireUniqueStrings(values: string[], label: string) {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }

  if (duplicates.size > 0) {
    throw new Error(`${label} innehåller dubbletter: ${Array.from(duplicates).join(', ')}.`)
  }
}

function parseImportedCourse(raw: string): ParsedCourse {
  let payload: ImportedCoursePayload

  try {
    payload = JSON.parse(raw) as ImportedCoursePayload
  } catch {
    throw new Error('JSON kunde inte läsas. Kontrollera kommatecken, citattecken och klamrar.')
  }

  const name = text(payload.name ?? payload.courseName)
  const clubName = text(payload.club_name ?? payload.clubName ?? name)

  if (!name) throw new Error('JSON saknar "name" eller "courseName".')
  if (!clubName) throw new Error('JSON saknar "club_name" eller "clubName".')
  if (!Array.isArray(payload.holes) || payload.holes.length === 0) {
    throw new Error('JSON saknar holes. Lägg till minst ett hål.')
  }

  const holes = payload.holes
    .map((hole, index) => {
      const holeNumber = numberOrNull(hole.hole_number)
      const par = numberOrNull(hole.par)
      const hcpIndex = numberOrNull(hole.hcp_index)
      const yellow = numberOrNull(hole.length_yellow)
      const red = numberOrNull(hole.length_red)

      if (holeNumber == null) throw new Error(`Hålrad ${index + 1} saknar hole_number.`)
      if (par == null) throw new Error(`Hål ${holeNumber} saknar par.`)
      if (hcpIndex == null) throw new Error(`Hål ${holeNumber} saknar hcp_index.`)
      if (yellow == null) throw new Error(`Hål ${holeNumber} saknar length_yellow.`)
      if (red == null) throw new Error(`Hål ${holeNumber} saknar length_red.`)

      const normalized = {
        hole_number: Math.floor(holeNumber),
        par: Math.floor(par),
        hcp_index: Math.floor(hcpIndex),
        length_yellow: Math.floor(yellow),
        length_red: Math.floor(red),
      }

      if (normalized.hole_number < 1 || normalized.hole_number > 18) {
        throw new Error(`Hål ${normalized.hole_number} är ogiltigt. Använd 1-18.`)
      }

      if (normalized.par < 3 || normalized.par > 6) {
        throw new Error(`Hål ${normalized.hole_number} har orimligt par: ${normalized.par}.`)
      }

      if (normalized.hcp_index < 1 || normalized.hcp_index > 18) {
        throw new Error(`Hål ${normalized.hole_number} har ogiltigt hcp_index: ${normalized.hcp_index}.`)
      }

      if (normalized.length_yellow <= 0 || normalized.length_red <= 0) {
        throw new Error(`Hål ${normalized.hole_number} har ogiltig längd.`)
      }

      return normalized
    })
    .sort((a, b) => a.hole_number - b.hole_number)

  requireUniqueNumbers(
    holes.map((hole) => hole.hole_number),
    'Hålnummer'
  )

  if (holes.length === 18) {
    requireUniqueNumbers(
      holes.map((hole) => hole.hcp_index),
      'HCP-index'
    )
  }

  const tees = Array.isArray(payload.tees)
    ? payload.tees
        .map((tee) => {
          const key = teeKey(tee.tee_key)
          if (!key) return null

          const courseRating = tee.course_rating == null ? null : numberOrNull(tee.course_rating)
          const slopeRating = tee.slope_rating == null ? null : numberOrNull(tee.slope_rating)
          const parTotal = tee.par_total == null ? null : numberOrNull(tee.par_total)

          if (tee.course_rating != null && courseRating == null) {
            throw new Error(`Tee ${key} har ogiltig course_rating.`)
          }
          if (tee.slope_rating != null && slopeRating == null) {
            throw new Error(`Tee ${key} har ogiltig slope_rating.`)
          }
          if (tee.par_total != null && parTotal == null) {
            throw new Error(`Tee ${key} har ogiltig par_total.`)
          }

          return {
            tee_key: key,
            label: text(tee.label),
            course_rating: courseRating,
            slope_rating: slopeRating == null ? null : Math.floor(slopeRating),
            par_total: parTotal == null ? null : Math.floor(parTotal),
          }
        })
        .filter((tee): tee is ImportedTee => tee !== null)
    : []

  requireUniqueStrings(
    tees.map((tee) => tee.tee_key),
    'Tees'
  )

  return { name, club_name: clubName, holes, tees }
}

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const supabase = await requireAdmin()

  async function createCourse(formData: FormData) {
    'use server'

    const supabase = await requireAdmin()
    const name = text(formData.get('name'))
    const clubName = text(formData.get('club_name') ?? name)

    if (!name) fail('/admin/courses', 'error', 'Du måste ange banans namn.')

    const { data, error } = await supabase
      .from('courses')
      .insert({ name, club_name: clubName || name })
      .select('id')
      .single()

    if (error || !data?.id) {
      fail('/admin/courses', 'error', `Kunde inte skapa bana: ${error?.message ?? 'okänt fel'}`)
    }

    revalidatePath('/admin/courses')
    revalidatePath('/rounds/new')
    fail(`/admin/courses/${data.id}/holes`, 'success', 'Bana skapad.')
  }

  async function importCourseFromJson(formData: FormData) {
    'use server'

    const supabase = await requireAdmin()
    const raw = text(formData.get('json'))

    if (!raw) fail('/admin/courses', 'error', 'Klistra in JSON först.')

    let parsed: ParsedCourse
    try {
      parsed = parseImportedCourse(raw)
    } catch (error) {
      fail('/admin/courses', 'error', error instanceof Error ? error.message : 'Ogiltig JSON.')
    }

    const { data: createdCourse, error: courseError } = await supabase
      .from('courses')
      .insert({ name: parsed.name, club_name: parsed.club_name })
      .select('id')
      .single()

    if (courseError || !createdCourse?.id) {
      fail('/admin/courses', 'error', `Kunde inte skapa bana: ${courseError?.message ?? 'okänt fel'}`)
    }

    const courseId = createdCourse.id

    const { error: holesError } = await supabase.from('course_holes').upsert(
      parsed.holes.map((hole) => ({
        course_id: courseId,
        hole_number: hole.hole_number,
        par: hole.par,
        hcp_index: hole.hcp_index,
        length_yellow: hole.length_yellow,
        length_red: hole.length_red,
      })),
      { onConflict: 'course_id,hole_number' }
    )

    if (holesError) {
      fail(
        `/admin/courses/${courseId}/holes`,
        'warning',
        `Bana skapad, men hålen kunde inte sparas: ${holesError.message}`
      )
    }

    for (const tee of parsed.tees) {
      const { data: existing, error: existingError } = await supabase
        .from('course_tees')
        .select('id')
        .eq('course_id', courseId)
        .eq('tee_key', tee.tee_key)
        .maybeSingle()

      if (existingError) {
        fail(
          `/admin/courses/${courseId}/holes`,
          'warning',
          `Bana och hål sparades, men tee kunde inte kontrolleras: ${existingError.message}`
        )
      }

      const teePayload = {
        course_id: courseId,
        tee_key: tee.tee_key,
        course_rating: tee.course_rating,
        slope_rating: tee.slope_rating,
        par_total: tee.par_total,
      }

      const { error: teeError } = existing?.id
        ? await supabase
            .from('course_tees')
            .update({
              course_rating: tee.course_rating,
              slope_rating: tee.slope_rating,
              par_total: tee.par_total,
            })
            .eq('id', existing.id)
        : await supabase.from('course_tees').insert(teePayload)

      if (teeError) {
        fail(
          `/admin/courses/${courseId}/holes`,
          'warning',
          `Bana och hål sparades, men tee "${tee.tee_key}" kunde inte sparas: ${teeError.message}`
        )
      }
    }

    revalidatePath('/admin/courses')
    revalidatePath('/rounds/new')
    fail(
      `/admin/courses/${courseId}/holes`,
      'success',
      `${parsed.name} importerad med ${parsed.holes.length} hål och ${parsed.tees.length} tees.`
    )
  }

  const { data: coursesData, error: coursesError } = await supabase
    .from('courses')
    .select('id, name, club_name')
    .order('name', { ascending: true })

  const courses = (coursesData ?? []) as CourseRow[]
  const flashType = params.type ?? 'success'
  const flash =
    flashType === 'success'
      ? { icon: '✅', border: '#bbf7d0', bg: '#f0fdf4', text: '#14532d' }
      : flashType === 'warning'
        ? { icon: '⚠️', border: '#fde68a', bg: '#fffbeb', text: '#78350f' }
        : { icon: '❌', border: '#fecaca', bg: '#fef2f2', text: '#7f1d1d' }

  const exampleJson = `{
  "name": "Töreboda GK",
  "club_name": "Töreboda Golfklubb",
  "holes": [
    { "hole_number": 1, "par": 4, "hcp_index": 9, "length_yellow": 325, "length_red": 295 },
    { "hole_number": 2, "par": 3, "hcp_index": 11, "length_yellow": 180, "length_red": 155 }
  ],
  "tees": [
    { "tee_key": "yellow", "label": "Gul", "course_rating": 69.6, "slope_rating": 131, "par_total": 70 },
    { "tee_key": "red", "label": "Röd", "course_rating": 64.9, "slope_rating": 122, "par_total": 70 }
  ]
}`

  return (
    <main style={pageStyle}>
      <div className="container" style={containerStyle}>
        <section className="card" style={heroStyle}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={heroTopStyle}>
              <div>
                <span className="badge">Admin · Banbibliotek</span>
                <h1 style={titleStyle}>Banor</h1>
                <p className="muted" style={{ margin: '8px 0 0', maxWidth: 580 }}>
                  Skapa, importera och kvalitetssäkra golfbanor med hål, tees, slope och rating.
                </p>
              </div>
              <Link href="/admin/users" className="button secondary" style={roundButtonStyle}>
                Admin users
              </Link>
            </div>

            <div style={statsGridStyle}>
              <div style={statPillStyle}>
                <span style={statLabelStyle}>Banor</span>
                <strong style={statValueStyle}>{courses.length}</strong>
              </div>
              <div style={statPillStyle}>
                <span style={statLabelStyle}>Import</span>
                <strong style={statValueStyle}>JSON</strong>
              </div>
              <div style={statPillStyle}>
                <span style={statLabelStyle}>Status</span>
                <strong style={statValueStyle}>PWA-redo</strong>
              </div>
            </div>
          </div>
        </section>

        {params.message ? (
          <div
            className="card"
            style={{
              ...noticeStyle,
              border: `1px solid ${flash.border}`,
              background: flash.bg,
              color: flash.text,
            }}
          >
            <span aria-hidden="true">{flash.icon}</span>
            <span>{params.message}</span>
          </div>
        ) : null}

        {coursesError ? (
          <div className="card" style={{ ...noticeStyle, border: '1px solid #fecaca', background: '#fef2f2', color: '#7f1d1d' }}>
            Kunde inte hämta banor: {coursesError.message}
          </div>
        ) : null}

        <section style={twoColumnStyle}>
          <div className="card" style={panelStyle}>
            <div>
              <span style={eyebrowStyle}>Snabbstart</span>
              <h2 style={sectionTitleStyle}>Skapa bana manuellt</h2>
              <p className="muted" style={{ margin: '8px 0 0' }}>
                Skapar en tom bana. Fyll hål och tees i nästa steg.
              </p>
            </div>

            <form action={createCourse} style={formStyle}>
              <label style={labelStyle} htmlFor="course-name">Banans namn</label>
              <input id="course-name" name="name" placeholder="Exempel: Töreboda GK" required autoComplete="off" style={inputStyle} />

              <label style={labelStyle} htmlFor="club-name">Klubbnamn</label>
              <input id="club-name" name="club_name" placeholder="Exempel: Töreboda Golfklubb" autoComplete="off" style={inputStyle} />

              <button type="submit" className="button" style={primaryButtonStyle}>Skapa bana</button>
            </form>
          </div>

          <div className="card" style={panelStyle}>
            <div>
              <span style={eyebrowStyle}>Premiumimport</span>
              <h2 style={sectionTitleStyle}>Importera med JSON</h2>
              <p className="muted" style={{ margin: '8px 0 0' }}>
                Validerar namn, klubbnamn, hål, hcp-index, längder och tees innan sparning.
              </p>
            </div>

            <form action={importCourseFromJson} style={formStyle}>
              <label style={labelStyle} htmlFor="course-json">JSON</label>
              <textarea
                id="course-json"
                name="json"
                required
                rows={14}
                spellCheck={false}
                placeholder={exampleJson}
                style={textareaStyle}
              />
              <button type="submit" className="button" style={primaryButtonStyle}>Importera bana</button>
            </form>
          </div>
        </section>

        <section className="card" style={panelStyle}>
          <div style={listHeaderStyle}>
            <div>
              <span style={eyebrowStyle}>Bibliotek</span>
              <h2 style={{ ...sectionTitleStyle, marginTop: 4 }}>Befintliga banor</h2>
            </div>
            <div className="muted" style={countPillStyle}>{courses.length} st</div>
          </div>

          {courses.length === 0 ? (
            <div style={emptyStyle}>Inga banor hittades ännu. Importera din första bana med JSON ovan.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {courses.map((course) => (
                <div key={course.id} style={courseCardStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={courseNameStyle}>{course.name}</div>
                    {course.club_name ? <div className="muted" style={{ marginTop: 3, fontSize: 13 }}>{course.club_name}</div> : null}
                  </div>
                  <Link href={`/admin/courses/${course.id}/holes`} className="button secondary" style={editButtonStyle}>
                    Redigera
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

const pageStyle: CSSProperties = {
  minHeight: '100dvh',
  background: 'radial-gradient(circle at top left, rgba(34,197,94,0.18), transparent 34%), linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)',
  paddingBottom: 'calc(28px + env(safe-area-inset-bottom))',
}

const containerStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
  paddingTop: 14,
  paddingBottom: 20,
}

const heroStyle: CSSProperties = {
  padding: 18,
  borderRadius: 24,
  border: '1px solid rgba(15,23,42,0.08)',
  boxShadow: '0 18px 48px rgba(15,23,42,0.08)',
}

const heroTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
}

const titleStyle: CSSProperties = {
  margin: '12px 0 0',
  letterSpacing: '-0.04em',
}

const statsGridStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
}

const statPillStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid rgba(15,23,42,0.08)',
  background: 'rgba(255,255,255,0.75)',
  padding: 12,
  display: 'grid',
  gap: 4,
}

const statLabelStyle: CSSProperties = {
  color: '#64748b',
  fontSize: 12,
  fontWeight: 800,
}

const statValueStyle: CSSProperties = {
  color: '#0f172a',
  fontSize: 20,
  letterSpacing: '-0.04em',
}

const noticeStyle: CSSProperties = {
  padding: 14,
  borderRadius: 18,
  fontWeight: 800,
  display: 'flex',
  gap: 10,
  alignItems: 'flex-start',
  boxShadow: '0 12px 28px rgba(15,23,42,0.06)',
}

const twoColumnStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
}

const panelStyle: CSSProperties = {
  padding: 16,
  display: 'grid',
  gap: 14,
  borderRadius: 24,
  border: '1px solid rgba(15,23,42,0.08)',
  boxShadow: '0 16px 40px rgba(15,23,42,0.07)',
}

const formStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
}

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  letterSpacing: '-0.03em',
  color: '#0f172a',
}

const eyebrowStyle: CSSProperties = {
  color: '#15803d',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const labelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: '#334155',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 50,
  borderRadius: 16,
  border: '1px solid #d1d5db',
  padding: '0 14px',
  boxSizing: 'border-box',
  background: '#ffffff',
  color: '#0f172a',
  outline: 'none',
}

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 300,
  padding: 14,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  fontSize: 13,
  lineHeight: 1.55,
  resize: 'vertical',
}

const primaryButtonStyle: CSSProperties = {
  minHeight: 52,
  borderRadius: 16,
  fontWeight: 900,
  boxShadow: '0 14px 28px rgba(22,163,74,0.2)',
}

const roundButtonStyle: CSSProperties = {
  minHeight: 46,
  borderRadius: 999,
}

const listHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
}

const countPillStyle: CSSProperties = {
  minHeight: 38,
  borderRadius: 999,
  display: 'grid',
  placeItems: 'center',
  padding: '0 12px',
  background: '#f8fafc',
  border: '1px solid #e5e7eb',
  fontWeight: 800,
}

const emptyStyle: CSSProperties = {
  border: '1px dashed #cbd5e1',
  borderRadius: 18,
  padding: 18,
  background: '#f8fafc',
  color: '#64748b',
  fontWeight: 700,
}

const courseCardStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  border: '1px solid #e5e7eb',
  borderRadius: 18,
  padding: 12,
  background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
}

const courseNameStyle: CSSProperties = {
  fontWeight: 900,
  color: '#0f172a',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const editButtonStyle: CSSProperties = {
  minHeight: 44,
  borderRadius: 999,
  whiteSpace: 'nowrap',
  paddingInline: 14,
}
