import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ProfileForm } from "@/components/auth/profile-form"
import { ProfileHeader } from "@/components/auth/profile-header"

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <ProfileHeader />
        <ProfileForm profile={profile} userId={user.id} userEmail={user.email ?? ""} />
      </div>
    </div>
  )
}

