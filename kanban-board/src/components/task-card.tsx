"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Task } from "@/types/kanban"
import { GripVertical } from "lucide-react"
import { Draggable } from "@hello-pangea/dnd"

interface TaskCardProps {
  task: Task
  index: number
  onClick: () => void
}

export function TaskCard({ task, index, onClick }: TaskCardProps) {
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="mb-3"
        >
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={onClick}
          >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm leading-tight">{task.title}</p>
            {task.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {task.description}
              </p>
            )}
            <Badge variant="secondary" className="mt-2 text-xs">
              {new Date(task.created_at).toLocaleDateString()}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
        </div>
      )}
    </Draggable>
  )
}
