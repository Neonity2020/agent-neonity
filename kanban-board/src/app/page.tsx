import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/header"

export default async function Home() {
  const supabase = await createClient()
  
  const { data: boards } = await supabase
    .from("boards")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    
  if (boards && boards.length > 0) {
    redirect(`/board/${boards[0].id}`)
  }

  return (
    <div className="flex flex-col h-full">
      <Header />
      <div className="flex flex-1 items-center justify-center bg-muted/20">
        <div className="text-center space-y-4 max-w-sm">
          <h2 className="text-2xl font-bold tracking-tight">Welcome to Kanban</h2>
          <p className="text-muted-foreground">You don't have any projects yet. Use the "New Project" button in the header to get started.</p>
        </div>
      </div>
    </div>
  )
}
