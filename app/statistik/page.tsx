import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type RoundPlayerRow = {
  id: string
  round_id: string
}

type RoundRow = {
  id: string
  title: string
  course_id: string
  created_at: string
  holes_mode: number | null
  status: string | null
}

type HoleScoreRow = {
  round_player_id: string
  hole_number: number | null
  strokes: number | null
}

type CourseRow = {
  id: string
  name: string
}

type CourseHoleRow = {
  course_id: string
  hole_number: number
  par: number
}

type SearchParams = Record<string, string | string[] | undefined>

type PageProps = {
  searchParams?: SearchParams | Promise<SearchParams>
}

type RoundType = 'all' | '9' | '18'
type PeriodKey = '30d' | '90d' | 'year' | 'all'

const MIN_HOLE_SAMPLES = 2

const periodOptions = [
  { key: '30d', label: '30 dagar' },
  { key: '90d', label: '90 dagar' },
  { key: 'year', label: 'I år' },
  { key: 'all', label: 'All tid' },
] as const

const roundTypeOptions = [
  { key: 'all', label: 'Alla rundor' },
  { key: '9', label: '9 hål' },
  { key: '18', label: '18 hål' },
] as const

function normalizeText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function formatSigned(value: number) {
  const rounded = Number(value.toFixed(2))
  if (rounded > 0) return `+${rounded.toFixed(2)}`
  if (rounded < 0) return rounded.toFixed(2)
  return '0.00'
}

function getFirstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}

function getPeriodStartDate(period: PeriodKey, now: Date) {
  if (period === '30d') {
    const value = new Date(now)
    value.setDate(value.getDate() - 30)
    return value
  }

  if (period === '90d') {
    const value = new Date(now)
    value.setDate(value.getDate() - 90)
    return value
  }

  if (period === 'year') {
    return new Date(now.getFullYear(), 0, 1)
  }

  return null
}

function getRoundHoles(item: { holes: number; round: RoundRow }) {
  if (item.round.holes_mode === 9 || item.round.holes_mode === 18) {
    return item.round.holes_mode
  }

  return item.holes
}

function getRoundTypeLabel(roundType: RoundType) {
  if (roundType === '9') return '9-hålsrundor'
  if (roundType === '18') return '18-hålsrundor'
  return 'Alla rundor'
}

function formatDate(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Okänt datum'
  return date.toLocaleDateString('sv-SE')
}

export default async function StatistikPage({ searchParams }: PageProps) {
  let resolvedSearchParams: SearchParams = {}

  if (searchParams) {
    if (typeof (searchParams as Promise<SearchParams>).then === 'function') {
      resolvedSearchParams = await (searchParams as Promise<SearchParams>)
    } else {
      resolvedSearchParams = searchParams as SearchParams
    }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: playerRowsData, error: playerRowsError } = await supabase
    .from('round_players')
    .select('id, round_id')
    .eq('user_id', user.id)

  if (playerRowsError) {
    console.error('Failed to load round players for statistik:', playerRowsError)
  }

  const playerRows = (playerRowsData as RoundPlayerRow[] | null) ?? []
  const roundIds = Array.from(new Set(playerRows.map((row) => row.round_id)))

  let rounds: RoundRow[] = []
  let courses: CourseRow[] = []
  let holeScores: HoleScoreRow[] = []
  let courseHoles: CourseHoleRow[] = []

  if (roundIds.length > 0) {
    const [
      { data: roundsData, error: roundsError },
      { data: coursesData, error: coursesError },
      { data: holeScoresData, error: holeScoresError },
    ] = await Promise.all([
      supabase
        .from('rounds')
        .select('id, title, course_id, created_at, holes_mode, status')
        .in('id', roundIds)
        .in('status', ['completed', 'finished'])
        .order('created_at', { ascending: false }),
      supabase.from('courses').select('id, name'),
      supabase
        .from('hole_scores')
        .select('round_player_id, hole_number, strokes')
        .in(
          'round_player_id',
          playerRows.map((row) => row.id)
        ),
    ])

    if (roundsError) console.error('Failed to load rounds for statistik:', roundsError)
    if (coursesError) console.error('Failed to load courses for statistik:', coursesError)
    if (holeScoresError) console.error('Failed to load hole scores for statistik:', holeScoresError)

    rounds = (roundsData as RoundRow[] | null) ?? []
    courses = (coursesData as CourseRow[] | null) ?? []
    holeScores = (holeScoresData as HoleScoreRow[] | null) ?? []

    const courseIds = Array.from(new Set(rounds.map((round) => round.course_id)))

    if (courseIds.length > 0) {
      const { data: courseHolesData, error: courseHolesError } = await supabase
        .from('course_holes')
        .select('course_id, hole_number, par')
        .in('course_id', courseIds)

      if (courseHolesError) {
        console.error('Failed to load course holes for statistik:', courseHolesError)
      }

      courseHoles = (courseHolesData as CourseHoleRow[] | null) ?? []
    }
  }

  const playerRoundById = new Map(playerRows.map((row) => [row.id, row.round_id] as const))
  const roundById = new Map(rounds.map((round) => [round.id, round] as const))
  const courseById = new Map(courses.map((course) => [course.id, course] as const))

  const roundTotals = new Map<string, { strokes: number; holes: number }>()

  for (const score of holeScores) {
    if (typeof score.strokes !== 'number') continue

    const roundId = playerRoundById.get(score.round_player_id)
    if (!roundId || !roundById.has(roundId)) continue

    const current = roundTotals.get(roundId) ?? { strokes: 0, holes: 0 }
    current.strokes += score.strokes
    current.holes += 1
    roundTotals.set(roundId, current)
  }

  const completedSummaries = rounds
    .map((round) => {
      const total = roundTotals.get(round.id)
      if (!total || total.holes === 0) return null

      return {
        round,
        totalStrokes: total.strokes,
        holes: total.holes,
        avgPerHole: total.strokes / total.holes,
      }
    })
    .filter(
      (
        item
      ): item is {
        round: RoundRow
        totalStrokes: number
        holes: number
        avgPerHole: number
      } => item !== null
    )

  const karstaCourse = courses.find((course) => normalizeText(course.name).includes('karsta'))

  const periodParam = getFirstParam(resolvedSearchParams.period)
  const selectedPeriod: PeriodKey =
    periodParam === '30d' || periodParam === '90d' || periodParam === 'year' || periodParam === 'all'
      ? periodParam
      : 'all'

  const roundTypeParam = getFirstParam(resolvedSearchParams.roundType)
  const selectedRoundType: RoundType =
    roundTypeParam === '9' || roundTypeParam === '18' || roundTypeParam === 'all'
      ? roundTypeParam
      : 'all'

  const courseIdsInData = new Set(completedSummaries.map((item) => item.round.course_id))
  const courseOptions = courses
    .filter((course) => courseIdsInData.has(course.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'sv-SE'))

  const courseParam = getFirstParam(resolvedSearchParams.course)
  const defaultCourseId = karstaCourse?.id ?? 'all'
  const selectedCourseId =
    courseParam === 'all'
      ? 'all'
      : courseParam && courseById.has(courseParam)
      ? courseParam
      : defaultCourseId

  const periodStartDate = getPeriodStartDate(selectedPeriod, new Date())

  const filteredSummaries = completedSummaries.filter((item) => {
    if (selectedCourseId !== 'all' && item.round.course_id !== selectedCourseId) return false

    if (selectedRoundType !== 'all' && getRoundHoles(item) !== Number(selectedRoundType)) return false

    if (!periodStartDate) return true

    const playedAt = new Date(item.round.created_at)
    return Number.isFinite(playedAt.getTime()) && playedAt >= periodStartDate
  })

  const selectedCourseName =
    selectedCourseId === 'all' ? 'Alla banor' : courseById.get(selectedCourseId)?.name ?? 'Vald bana'

  const totalHolesPlayed = filteredSummaries.reduce((sum, item) => sum + item.holes, 0)
  const totalStrokesPlayed = filteredSummaries.reduce((sum, item) => sum + item.totalStrokes, 0)

  const averagePerHole = totalHolesPlayed > 0 ? totalStrokesPlayed / totalHolesPlayed : null

  const bestRound =
    filteredSummaries.length > 0
      ? filteredSummaries.reduce((best, item) => (item.avgPerHole < best.avgPerHole ? item : best))
      : null

  const parByHole = new Map<number, number>()

  if (selectedCourseId !== 'all') {
    for (const hole of courseHoles) {
      if (hole.course_id !== selectedCourseId) continue
      parByHole.set(hole.hole_number, hole.par)
    }
  }

  const selectedRoundIds = new Set(filteredSummaries.map((item) => item.round.id))
  const holeAgg = new Map<number, { strokes: number; count: number }>()

  if (selectedCourseId !== 'all') {
    for (const score of holeScores) {
      if (typeof score.strokes !== 'number') continue
      if (typeof score.hole_number !== 'number') continue

      const roundId = playerRoundById.get(score.round_player_id)
      if (!roundId || !selectedRoundIds.has(roundId)) continue

      const current = holeAgg.get(score.hole_number) ?? { strokes: 0, count: 0 }
      current.strokes += score.strokes
      current.count += 1
      holeAgg.set(score.hole_number, current)
    }
  }

  const holeStats = Array.from(holeAgg.entries()).map(([holeNumber, aggregate]) => {
    const avg = aggregate.strokes / aggregate.count
    const par = parByHole.get(holeNumber)
    const avgToPar = par != null ? avg - par : null

    return {
      holeNumber,
      avg,
      par: par ?? null,
      avgToPar,
      count: aggregate.count,
    }
  })

  const comparableHoleStats = holeStats.filter((hole) => hole.count >= MIN_HOLE_SAMPLES)

  const hardestHoles = [...comparableHoleStats]
    .sort((a, b) => {
      const aScore = a.avgToPar ?? a.avg
      const bScore = b.avgToPar ?? b.avg
      if (bScore !== aScore) return bScore - aScore
      return b.count - a.count
    })
    .slice(0, 5)

  const bestHoles = [...comparableHoleStats]
    .sort((a, b) => {
      const aScore = a.avgToPar ?? a.avg
      const bScore = b.avgToPar ?? b.avg
      if (aScore !== bScore) return aScore - bScore
      return b.count - a.count
    })
    .slice(0, 3)

  const trendRounds = filteredSummaries.slice(0, 5)
  const roundTypeLabel = getRoundTypeLabel(selectedRoundType)

  function buildFilterHref(nextCourse: string, nextPeriod: PeriodKey, nextRoundType: RoundType) {
    const params = new URLSearchParams()
    if (nextCourse !== 'all') params.set('course', nextCourse)
    if (nextPeriod !== 'all') params.set('period', nextPeriod)
    if (nextRoundType !== 'all') params.set('roundType', nextRoundType)
    const query = params.toString()
    return query ? `/statistik?${query}` : '/statistik'
  }

  const pageStyle = {
    paddingBottom: 32,
  } as const

  const containerStyle = {
    display: 'grid',
    gap: 14,
  } as const

  const heroStyle = {
    borderRadius: 28,
    padding: '18px 18px 16px',
    background: 'linear-gradient(135deg, rgba(240,253,244,0.98), rgba(255,255,255,0.98))',
  } as const

  const sectionStyle = {
    borderRadius: 24,
    padding: 16,
  } as const

  const scrollPillsStyle = {
    display: 'flex',
    gap: 10,
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    padding: '2px 2px 8px',
    scrollbarWidth: 'none',
  } as const

  const statGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: 12,
  } as const

  const statCardStyle = {
    borderRadius: 22,
    padding: 16,
    minHeight: 118,
    display: 'grid',
    alignContent: 'space-between',
  } as const

  const rowCardStyle = {
    border: '1px solid #e5e7eb',
    borderRadius: 18,
    padding: 14,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'center',
    background: 'rgba(255,255,255,0.78)',
  } as const

  const bigNumberStyle = {
    fontSize: 'clamp(34px, 9vw, 48px)',
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: '-0.04em',
    marginTop: 12,
  } as const

  return (
    <main style={pageStyle}>
      <div className="container" style={containerStyle}>
        <div className="card" style={heroStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'flex-start',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div className="muted" style={{ fontWeight: 900, marginBottom: 6 }}>
                📊 Din spelanalys
              </div>
              <h1
                className="title"
                style={{
                  margin: 0,
                  fontSize: 'clamp(30px, 8vw, 46px)',
                  lineHeight: 1.02,
                  letterSpacing: '-0.05em',
                }}
              >
                Statistik
              </h1>
              <p className="meta" style={{ marginTop: 10, maxWidth: 620 }}>
                Filtrera på bana, period och rundtyp. Snitten räknas på spelade hål så 9- och
                18-hålsrundor blir rättvist jämförda.
              </p>
            </div>

            <Link href="/dashboard" className="button secondary" style={{ whiteSpace: 'nowrap' }}>
              ← Startsidan
            </Link>
          </div>
        </div>

        <div className="card" style={sectionStyle}>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <div className="muted" style={{ marginBottom: 8, fontWeight: 900 }}>
                ⛳ Bana
              </div>
              <div style={scrollPillsStyle}>
                <Link
                  href={buildFilterHref('all', selectedPeriod, selectedRoundType)}
                  className={`button ${selectedCourseId === 'all' ? '' : 'secondary'}`}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Alla banor
                </Link>
                {courseOptions.map((course) => (
                  <Link
                    key={course.id}
                    href={buildFilterHref(course.id, selectedPeriod, selectedRoundType)}
                    className={`button ${selectedCourseId === course.id ? '' : 'secondary'}`}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {course.name}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <div className="muted" style={{ marginBottom: 8, fontWeight: 900 }}>
                📅 Period
              </div>
              <div style={scrollPillsStyle}>
                {periodOptions.map((period) => (
                  <Link
                    key={period.key}
                    href={buildFilterHref(selectedCourseId, period.key, selectedRoundType)}
                    className={`button ${selectedPeriod === period.key ? '' : 'secondary'}`}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {period.label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <div className="muted" style={{ marginBottom: 8, fontWeight: 900 }}>
                🏌️ Rundtyp
              </div>
              <div style={scrollPillsStyle}>
                {roundTypeOptions.map((option) => (
                  <Link
                    key={option.key}
                    href={buildFilterHref(selectedCourseId, selectedPeriod, option.key)}
                    className={`button ${selectedRoundType === option.key ? '' : 'secondary'}`}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {option.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={statGridStyle}>
          <div className="card" style={statCardStyle}>
            <div className="muted">🏁 Avslutade rundor</div>
            <div style={bigNumberStyle}>{filteredSummaries.length}</div>
            <div className="meta" style={{ marginTop: 8 }}>
              {roundTypeLabel}
            </div>
          </div>

          <div className="card" style={statCardStyle}>
            <div className="muted">📈 Snitt per hål</div>
            <div style={bigNumberStyle}>{averagePerHole == null ? '-' : averagePerHole.toFixed(2)}</div>
            <div className="meta" style={{ marginTop: 8 }}>
              {selectedCourseName}
            </div>
          </div>

          <div className="card" style={statCardStyle}>
            <div className="muted">📍 Registrerade hål</div>
            <div style={bigNumberStyle}>{totalHolesPlayed}</div>
            <div className="meta" style={{ marginTop: 8 }}>
              {totalStrokesPlayed} slag totalt
            </div>
          </div>
        </div>

        <div className="card" style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px, 6vw, 34px)', letterSpacing: '-0.04em' }}>
            🔥 Svåraste hål {selectedCourseId === 'all' ? '' : `på ${selectedCourseName}`}
          </h2>
          <p className="meta" style={{ marginTop: 8 }}>
            Baserat på valda filter: {roundTypeLabel.toLowerCase()}.
          </p>

          {selectedCourseId === 'all' ? (
            <div className="notice" style={{ marginTop: 12 }}>
              Välj en specifik bana för hål-för-hål statistik.
            </div>
          ) : hardestHoles.length === 0 ? (
            <div className="notice" style={{ marginTop: 12 }}>
              Minst {MIN_HOLE_SAMPLES} varv per hål krävs för att visa statistik.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {hardestHoles.map((hole, index) => (
                <div key={`hard-hole-${hole.holeNumber}`} style={rowCardStyle}>
                  <div style={{ fontWeight: 950, fontSize: 18 }}>
                    #{index + 1} · Hål {hole.holeNumber}
                  </div>
                  <div className="muted" style={{ textAlign: 'right' }}>
                    Snitt {hole.avg.toFixed(2)} slag
                    {hole.avgToPar == null ? '' : ` (${formatSigned(hole.avgToPar)} mot par)`}
                    {' · '}
                    {hole.count} varv
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px, 6vw, 34px)', letterSpacing: '-0.04em' }}>
            ✅ Bästa hål {selectedCourseId === 'all' ? '' : `på ${selectedCourseName}`}
          </h2>
          <p className="meta" style={{ marginTop: 8 }}>
            Lägst snitt mot par, minst {MIN_HOLE_SAMPLES} varv.
          </p>

          {selectedCourseId === 'all' ? (
            <div className="notice" style={{ marginTop: 12 }}>
              Välj en specifik bana för hål-för-hål statistik.
            </div>
          ) : bestHoles.length === 0 ? (
            <div className="notice" style={{ marginTop: 12 }}>
              Minst {MIN_HOLE_SAMPLES} varv per hål krävs för att visa statistik.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {bestHoles.map((hole, index) => (
                <div key={`best-hole-${hole.holeNumber}`} style={rowCardStyle}>
                  <div style={{ fontWeight: 950, fontSize: 18 }}>
                    #{index + 1} · Hål {hole.holeNumber}
                  </div>
                  <div className="muted" style={{ textAlign: 'right' }}>
                    Snitt {hole.avg.toFixed(2)} slag
                    {hole.avgToPar == null ? '' : ` (${formatSigned(hole.avgToPar)} mot par)`}
                    {' · '}
                    {hole.count} varv
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px, 6vw, 34px)', letterSpacing: '-0.04em' }}>
            🏆 Bästa runda
          </h2>
          <p className="meta" style={{ marginTop: 8 }}>
            Jämförs rättvist på snitt per hål.
          </p>

          {!bestRound ? (
            <div className="notice" style={{ marginTop: 12 }}>
              Ingen avslutad runda hittades för valt filter.
            </div>
          ) : (
            <div style={{ ...rowCardStyle, marginTop: 14 }}>
              <div>
                <div style={{ fontWeight: 950, fontSize: 20 }}>
                  {courseById.get(bestRound.round.course_id)?.name ?? 'Okänd bana'}
                </div>
                <div className="muted" style={{ marginTop: 4 }}>
                  {formatDate(bestRound.round.created_at)} · {getRoundHoles(bestRound)} hål
                </div>
              </div>
              <div style={{ fontWeight: 950, fontSize: 20, textAlign: 'right' }}>
                {bestRound.totalStrokes} slag
                <div className="meta" style={{ marginTop: 2 }}>
                  {bestRound.avgPerHole.toFixed(2)} / hål
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card" style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px, 6vw, 34px)', letterSpacing: '-0.04em' }}>
            🕘 Senaste rundor
          </h2>

          {filteredSummaries.length === 0 ? (
            <div className="notice" style={{ marginTop: 12 }}>
              Inga avslutade rundor med score hittades för valt filter.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {filteredSummaries.slice(0, 12).map((item) => (
                <div key={item.round.id} style={rowCardStyle}>
                  <div>
                    <div style={{ fontWeight: 950, fontSize: 18 }}>
                      {courseById.get(item.round.course_id)?.name ?? 'Okänd bana'}
                    </div>
                    <div className="muted" style={{ fontSize: 14, marginTop: 3 }}>
                      {formatDate(item.round.created_at)} · {getRoundHoles(item)} hål
                    </div>
                  </div>

                  <div style={{ fontWeight: 950, textAlign: 'right' }}>
                    ⛳ {item.totalStrokes} slag
                    <div className="meta" style={{ marginTop: 2 }}>
                      {item.avgPerHole.toFixed(2)} / hål
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px, 6vw, 34px)', letterSpacing: '-0.04em' }}>
            📉 Trend senaste 5 rundor
          </h2>

          {trendRounds.length === 0 ? (
            <div className="notice" style={{ marginTop: 12 }}>
              Ingen trenddata hittades för valt filter.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {trendRounds.map((item, index) => (
                <div key={`trend-${item.round.id}`} style={rowCardStyle}>
                  <div>
                    <div style={{ fontWeight: 950, fontSize: 18 }}>
                      #{index + 1} {courseById.get(item.round.course_id)?.name ?? 'Okänd bana'}
                    </div>
                    <div className="muted" style={{ fontSize: 14, marginTop: 3 }}>
                      {formatDate(item.round.created_at)} · {getRoundHoles(item)} hål
                    </div>
                  </div>

                  <div style={{ fontWeight: 950, textAlign: 'right' }}>
                    {item.avgPerHole.toFixed(2)}
                    <div className="meta" style={{ marginTop: 2 }}>
                      slag / hål
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
