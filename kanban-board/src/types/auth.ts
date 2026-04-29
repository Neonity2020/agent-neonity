export type UserProfile = {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type AuthState = {
  user: UserProfile | null
  isLoading: boolean
  isAuthenticated: boolean
}
