import { KanbanBoard } from "@/components/kanban-board"
import { Header } from "@/components/header"

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  
  return (
    <div className="flex flex-col h-full">
      <Header currentBoardId={resolvedParams.id} />
      <KanbanBoard boardId={resolvedParams.id} />
    </div>
  )
}
