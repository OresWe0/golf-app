export type Course = {
  id: string
  name: string
}

export type Profile = {
  id: string
  email?: string | null
  display_name?: string | null
  handicap_index?: number | null
  default_tee?: string | null
}

export type Round = {
  id: string
  owner_id: string
  course_id: string
  title: string
  scoring_mode: 'stableford' | 'strokeplay'
  status?: string | null
  holes_mode?: number | null
  start_hole?: number | null
  end_hole?: number | null
  current_hole?: number | null
}