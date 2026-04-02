export type Course = {
  id: string
  name: string
  club_name: string
  total_par: number
  holes_count: number
}

export type CourseHole = {
  id: string
  course_id: string
  hole_number: number
  par: number
  hcp_index: number
  length_yellow: number | null
  length_red: number | null
  description: string | null
}

export type CourseTee = {
  id: string
  course_id: string
  tee_key: string
  label: string
  course_rating: number | null
  slope_rating: number | null
  tee_par: number
}

export type Round = {
  id: string
  owner_id: string
  course_id: string
  title: string
  scoring_mode: 'strokeplay' | 'stableford'
  status: 'active' | 'completed'
  current_hole: number
  created_at: string
}

export type Profile = {
  id: string
  email: string | null
  display_name: string | null
  handicap_index: number | null
  default_tee: string | null
  created_at: string
}

export type RoundMember = {
  id: string
  round_id: string
  user_id: string
  role: 'owner' | 'player'
  created_at: string
}

export type RoundPlayer = {
  id: string
  round_id: string
  user_id: string | null
  invited_email: string | null
  display_name: string
  handicap_index: number | null
  exact_handicap: number | null
  tee_key: string | null
  playing_handicap: number | null
  sort_order: number
}

export type HoleScore = {
  id: string
  round_id: string
  round_player_id: string
  hole_number: number
  strokes: number | null
}
