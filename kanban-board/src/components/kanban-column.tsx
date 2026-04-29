"use client"

import { Column, Task } from "@/types/kanban"
import { useTranslation } from "@/lib/i18n"
import { TaskCard } from "./task-card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Droppable } from "@hello-pangea/dnd"

interface KanbanColumnProps {
  column: Column
  tasks: Task[]
  onAddTask: () => void
  onEditTask: (task: Task) => void
}

export function KanbanColumn({ column, tasks, onAddTask, onEditTask }: KanbanColumnProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: column.color }}
          />
          <h3 className="font-semibold text-sm">
            {column.name === "Backlog" ? t.columnNames.backlog :
             column.name === "To Do" ? t.columnNames.todo :
             column.name === "In Progress" ? t.columnNames.inProgress :
             column.name === "Done" ? t.columnNames.done :
             column.name}
          </h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onAddTask}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      <Droppable droppableId={column.id}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn("flex-1 rounded-lg p-2 min-h-[200px]", "bg-muted/50")}
            style={{ borderTop: `3px solid ${column.color}` }}
          >
            <div className="space-y-2">
              {tasks.map((task, index) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={index}
                  onClick={() => onEditTask(task)}
                />
              ))}
              {provided.placeholder}
            </div>
        
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <p className="text-sm">{t.column.noTasks}</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={onAddTask}>
              <Plus className="h-4 w-4 mr-1" />
              {t.column.addTask}
            </Button>
          </div>
        )}
          </div>
        )}
      </Droppable>
    </div>
  )
}
