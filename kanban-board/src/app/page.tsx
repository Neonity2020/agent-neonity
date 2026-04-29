import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { LandingPage } from "@/components/landing/landing-page"

export default async function Home() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  // If not logged in, show landing page
  if (!user) {
    return <LandingPage />
  }

  // If logged in, find user's boards
  const { data: boards } = await supabase
    .from("boards")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)

  if (boards && boards.length > 0) {
    redirect(`/board/${boards[0].id}`)
  }

  // Logged in but no boards - redirect to create one
  redirect("/board/new")
}
