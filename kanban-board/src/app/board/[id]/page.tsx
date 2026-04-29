import { KanbanBoard } from "@/components/kanban-board"
import { Header } from "@/components/header"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect("/")
  }

  return (
    <div className="flex flex-col h-full">
      <Header currentBoardId={resolvedParams.id} user={user} />
      <KanbanBoard boardId={resolvedParams.id} />
    </div>
  )
}
