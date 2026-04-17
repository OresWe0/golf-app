import Link from 'next/link'
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
  course_rating: number | null
  slope_rating: number | null
  par_total: number | null
}

type ImportedCoursePayload = {
  name?: string
  courseName?: string
  holes?: ImportedHole[]
  tees?: ImportedTee[]
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

  if (error || !me?.is_admin) {
    notFound()
  }

  return supabase
}

function toNumber(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function parseImportedCourse(raw: string): {
  name: string
  holes: ImportedHole[]
  tees: ImportedTee[]
} {
  const parsed = JSON.parse(raw) as ImportedCoursePayload
  const name = String(parsed.name ?? parsed.courseName ?? '').trim()

  if (!name) {
    throw new Error('JSON saknar "name" eller "courseName".')
  }

  const holes = (parsed.holes ?? [])
    .map((hole) => {
      const holeNumber = toNumber(hole.hole_number)
      const par = toNumber(hole.par)
      const hcpIndex = toNumber(hole.hcp_index)
      const yellow = toNumber(hole.length_yellow)
      const red = toNumber(hole.length_red)

      if (
        holeNumber == null ||
        par == null ||
        hcpIndex == null ||
        yellow == null ||
        red == null
      ) {
        throw new Error('En eller flera holes-rader har ogiltiga nummer.')
      }

      return {
        hole_number: Math.floor(holeNumber),
        par: Math.floor(par),
        hcp_index: Math.floor(hcpIndex),
        length_yellow: Math.floor(yellow),
        length_red: Math.floor(red),
      }
    })
    .filter((hole) => hole.hole_number >= 1 && hole.hole_number <= 18)

  const tees = (parsed.tees ?? [])
    .map((tee) => {
      const teeKey = String(tee.tee_key ?? '').trim().toLowerCase()
      if (!teeKey) return null

      const courseRating = tee.course_rating == null ? null : toNumber(tee.course_rating)
      const slopeRating = tee.slope_rating == null ? null : toNumber(tee.slope_rating)
      const parTotal = tee.par_total == null ? null : toNumber(tee.par_total)

      return {
        tee_key: teeKey,
        course_rating: courseRating,
        slope_rating: slopeRating == null ? null : Math.floor(slopeRating),
        par_total: parTotal == null ? null : Math.floor(parTotal),
      }
    })
    .filter((tee): tee is ImportedTee => tee !== null)

  return { name, holes, tees }
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
    const name = String(formData.get('name') ?? '').trim()

    if (!name) {
      redirect('/admin/courses?type=error&message=Du+maste+ange+banans+namn')
    }

    const { data, error } = await supabase
      .from('courses')
      .insert({ name })
      .select('id')
      .single()

    if (error || !data?.id) {
      redirect(
        `/admin/courses?type=error&message=${encodeURIComponent(
          `Kunde inte skapa bana: ${error?.message ?? 'okant fel'}`
        )}`
      )
    }

    revalidatePath('/admin/courses')
    revalidatePath('/rounds/new')

    redirect(`/admin/courses/${data.id}/holes?type=success&message=Bana+skapad`)
  }

  async function importCourseFromJson(formData: FormData) {
    'use server'

    const supabase = await requireAdmin()
    const raw = String(formData.get('json') ?? '').trim()

    if (!raw) {
      redirect('/admin/courses?type=error&message=Klistra+in+JSON+forst')
    }

    let parsed: { name: string; holes: ImportedHole[]; tees: ImportedTee[] }
    try {
      parsed = parseImportedCourse(raw)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ogiltig JSON.'
      redirect(`/admin/courses?type=error&message=${encodeURIComponent(message)}`)
    }

    const { data: createdCourse, error: courseError } = await supabase
      .from('courses')
      .insert({ name: parsed.name })
      .select('id')
      .single()

    if (courseError || !createdCourse?.id) {
      redirect(
        `/admin/courses?type=error&message=${encodeURIComponent(
          `Kunde inte skapa bana: ${courseError?.message ?? 'okant fel'}`
        )}`
      )
    }

    const courseId = createdCourse.id

    if (parsed.holes.length > 0) {
      const holesPayload = parsed.holes.map((hole) => ({
        course_id: courseId,
        hole_number: hole.hole_number,
        par: hole.par,
        hcp_index: hole.hcp_index,
        length_yellow: hole.length_yellow,
        length_red: hole.length_red,
      }))

      const { error } = await supabase
        .from('course_holes')
        .upsert(holesPayload, { onConflict: 'course_id,hole_number' })

      if (error) {
        redirect(
          `/admin/courses/${courseId}/holes?type=warning&message=${encodeURIComponent(
            `Bana skapad, men holes kunde inte sparas: ${error.message}`
          )}`
        )
      }
    }

    for (const tee of parsed.tees) {
      const { data: existing } = await supabase
        .from('course_tees')
        .select('id')
        .eq('course_id', courseId)
        .eq('tee_key', tee.tee_key)
        .maybeSingle()

      if (existing?.id) {
        await supabase
          .from('course_tees')
          .update({
            course_rating: tee.course_rating,
            slope_rating: tee.slope_rating,
            par_total: tee.par_total,
          })
          .eq('id', existing.id)
      } else {
        await supabase.from('course_tees').insert({
          course_id: courseId,
          tee_key: tee.tee_key,
          course_rating: tee.course_rating,
          slope_rating: tee.slope_rating,
          par_total: tee.par_total,
        })
      }
    }

    revalidatePath('/admin/courses')
    revalidatePath('/rounds/new')
    redirect(
      `/admin/courses/${courseId}/holes?type=success&message=${encodeURIComponent(
        'Bana importerad'
      )}`
    )
  }

  const { data: coursesData } = await supabase
    .from('courses')
    .select('id, name')
    .order('name', { ascending: true })

  const courses = (coursesData ?? []) as CourseRow[]
  const flashType = params.type ?? 'success'
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
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <span className="badge">Admin</span>
              <h1 style={{ marginTop: 12, marginBottom: 8 }}>Banor</h1>
              <p className="muted" style={{ margin: 0 }}>
                Skapa nya banor och importera holes/tees med JSON.
              </p>
            </div>
            <Link href="/admin/users" className="button secondary">
              Till admin users
            </Link>
          </div>
        </div>

        {params.message ? (
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
            {params.message}
          </div>
        ) : null}

        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          }}
        >
          <div className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
            <h2 style={{ margin: 0 }}>Skapa bana manuellt</h2>
            <p className="muted" style={{ margin: 0 }}>
              Skapar en tom bana. Du fyller holes/tees i nasta steg.
            </p>
            <form action={createCourse} style={{ display: 'grid', gap: 10 }}>
              <input
                name="name"
                placeholder="Exempel: Arboga Golfklubb"
                required
                style={{
                  width: '100%',
                  minHeight: 48,
                  borderRadius: 12,
                  border: '1px solid #d1d5db',
                  padding: '0 12px',
                  boxSizing: 'border-box',
                }}
              />
              <button type="submit" className="button">
                Skapa bana
              </button>
            </form>
          </div>

          <div className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
            <h2 style={{ margin: 0 }}>Importera med JSON</h2>
            <p className="muted" style={{ margin: 0 }}>
              Klistra in JSON med name, holes och tees.
            </p>
            <form action={importCourseFromJson} style={{ display: 'grid', gap: 10 }}>
              <textarea
                name="json"
                required
                rows={12}
                placeholder={`{
  "name": "Lindesbergs GK",
  "holes": [{"hole_number":1,"par":3,"hcp_index":7,"length_yellow":152,"length_red":124}],
  "tees": [{"tee_key":"yellow","course_rating":67.8,"slope_rating":121,"par_total":72}]
}`}
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
                Importera bana
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
              flexWrap: 'wrap',
              marginBottom: 12,
            }}
          >
            <h2 style={{ margin: 0 }}>Befintliga banor</h2>
            <div className="muted">{courses.length} st</div>
          </div>

          {courses.length === 0 ? (
            <div className="muted">Inga banor hittades.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {courses.map((course) => (
                <div
                  key={course.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    border: '1px solid #e5e7eb',
                    borderRadius: 14,
                    padding: 12,
                  }}
                >
                  <div style={{ fontWeight: 800 }}>{course.name}</div>
                  <Link href={`/admin/courses/${course.id}/holes`} className="button secondary">
                    Redigera holes/tees
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
