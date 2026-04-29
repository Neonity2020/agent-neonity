"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useTranslation } from "@/lib/i18n"
import { KanbanColumn } from "./kanban-column"
import { TaskDialog } from "./task-dialog"
import { Button } from "@/components/ui/button"
import { Column, Task } from "@/types/kanban"
import { Plus, RefreshCw } from "lucide-react"
import { DragDropContext, DropResult } from "@hello-pangea/dnd"

const DEFAULT_COLUMNS: Omit<Column, "id" | "board_id">[] = [
  { name: "Backlog", color: "#6b7280", order: 0 },
  { name: "To Do", color: "#3b82f6", order: 1 },
  { name: "In Progress", color: "#f59e0b", order: 2 },
  { name: "Done", color: "#22c55e", order: 3 },
]

interface KanbanBoardProps {
  boardId: string
}

export function KanbanBoard({ boardId }: KanbanBoardProps) {
  const [columns, setColumns] = useState<Column[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedColumnId, setSelectedColumnId] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  
  const supabase = createClient()
  const { t } = useTranslation()

  const fetchData = useCallback(async () => {
    // Skip if Supabase is not configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setError(t.kanban.configErrorDetail)
      setLoading(false)
      return
    }

    try {
      // Fetch columns
      const { data: columnsData } = await supabase
        .from("columns")
        .select("*")
        .eq("board_id", boardId)
        .order("order", { ascending: true })

      // Fetch tasks
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("*")
        .eq("board_id", boardId)
        .order("order", { ascending: true })

      if (columnsData) setColumns(columnsData)
      if (tasksData) setTasks(tasksData)

      // If no columns exist, initialize with defaults
      if (!columnsData || columnsData.length === 0) {
        await initializeColumns()
      }
    } catch (err) {
      console.error("Error fetching data:", err)
      setError(t.kanban.configErrorHint)
    } finally {
      setLoading(false)
    }
  }, [])

  const initializeColumns = async () => {
    const defaultColumnsWithIds = DEFAULT_COLUMNS.map((col, index) => ({
      ...col,
      id: `default-${index}`,
    }))

    const { data: insertedColumns } = await supabase
      .from("columns")
      .insert(DEFAULT_COLUMNS.map((col, index) => ({
        ...col,
        id: `default-${boardId}-${index}`,
        board_id: boardId,
      })))
      .select()

    if (insertedColumns) {
      setColumns(insertedColumns)
    }
  }

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAddTask = (columnId: string) => {
    setSelectedTask(null)
    setSelectedColumnId(columnId)
    setDialogOpen(true)
  }

  const handleEditTask = (task: Task) => {
    setSelectedTask(task)
    setSelectedColumnId(task.column_id)
    setDialogOpen(true)
  }

  const handleSaveTask = async (data: { title: string; description: string; column_id: string }) => {
    try {
      if (selectedTask) {
        // Update existing task
        const { data: updated } = await supabase
          .from("tasks")
          .update({
            title: data.title,
            description: data.description || null,
            column_id: data.column_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedTask.id)
          .select()
          .single()

        if (updated) {
          setTasks(tasks.map(t => t.id === updated.id ? updated : t))
        }
      } else {
        // Create new task
        const maxOrder = tasks
          .filter(t => t.column_id === data.column_id)
          .reduce((max, t) => Math.max(max, t.order), -1)

        const { data: newTask } = await supabase
          .from("tasks")
          .insert({
            title: data.title,
            description: data.description || null,
            column_id: data.column_id,
            board_id: boardId,
            order: maxOrder + 1,
          })
          .select()
          .single()

        if (newTask) {
          setTasks([...tasks, newTask])
        }
      }
    } catch (error) {
      console.error("Error saving task:", error)
    } finally {
      setDialogOpen(false)
      setSelectedTask(null)
    }
  }

  const handleDeleteTask = async () => {
    if (!selectedTask) return

    try {
      await supabase.from("tasks").delete().eq("id", selectedTask.id)
      setTasks(tasks.filter(t => t.id !== selectedTask.id))
    } catch (error) {
      console.error("Error deleting task:", error)
    } finally {
      setDialogOpen(false)
      setSelectedTask(null)
    }
  }

  const handleMoveTask = async (taskId: string, newColumnId: string) => {
    try {
      const maxOrder = tasks
        .filter(t => t.column_id === newColumnId)
        .reduce((max, t) => Math.max(max, t.order), -1)

      const { data: updated } = await supabase
        .from("tasks")
        .update({
          column_id: newColumnId,
          order: maxOrder + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .select()
        .single()

      if (updated) {
        setTasks(tasks.map(t => t.id === updated.id ? updated : t))
      }
    } catch (error) {
      console.error("Error moving task:", error)
    }
  }

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result

    if (!destination) return

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return
    }

    const task = tasks.find(t => t.id === draggableId)
    if (!task) return

    // Optimistically update UI
    const newTasks = [...tasks]
    
    const sourceTasks = newTasks.filter(t => t.column_id === source.droppableId).sort((a, b) => a.order - b.order)
    const destTasks = source.droppableId === destination.droppableId 
      ? sourceTasks 
      : newTasks.filter(t => t.column_id === destination.droppableId).sort((a, b) => a.order - b.order)

    const [movedTask] = sourceTasks.splice(source.index, 1)
    movedTask.column_id = destination.droppableId
    destTasks.splice(destination.index, 0, movedTask)

    const updatesToSave: Task[] = []
    
    sourceTasks.forEach((t, i) => {
      if (t.order !== i) {
        t.order = i
        updatesToSave.push(t)
      }
    })
    
    if (source.droppableId !== destination.droppableId) {
      destTasks.forEach((t, i) => {
        if (t.order !== i || t.id === movedTask.id) {
          t.order = i
          if (!updatesToSave.find(u => u.id === t.id)) {
             updatesToSave.push(t)
          }
        }
      })
    } else {
       if (!updatesToSave.find(u => u.id === movedTask.id)) {
           updatesToSave.push(movedTask)
       }
    }

    setTasks(newTasks)

    try {
      for (const t of updatesToSave) {
        await supabase
          .from("tasks")
          .update({
            column_id: t.column_id,
            order: t.order,
            updated_at: new Date().toISOString(),
          })
          .eq("id", t.id)
      }
    } catch (error) {
      console.error("Error updating tasks order:", error)
      fetchData() // revert on error
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center flex-col gap-4 p-8 text-center">
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
          <p className="font-medium">{t.kanban.configError}</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          {t.kanban.configErrorHint}
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-x-auto">
      <div className="w-fit mx-auto h-full">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 p-4 h-full">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            tasks={tasks.filter((t) => t.column_id === column.id).sort((a, b) => a.order - b.order)}
            onAddTask={() => handleAddTask(column.id)}
            onEditTask={handleEditTask}
          />
        ))}
        
        {columns.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
            <p className="text-lg mb-4">{t.kanban.noColumnsYet}</p>
            <Button onClick={initializeColumns}>
              <Plus className="h-4 w-4 mr-2" />
              {t.kanban.initializeBoard}
            </Button>
          </div>
        )}
        </div>
      </DragDropContext>
      </div>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={selectedTask}
        columns={columns}
        defaultColumnId={selectedColumnId}
        onSave={handleSaveTask}
        onDelete={selectedTask ? handleDeleteTask : undefined}
      />
    </div>
  )
}
