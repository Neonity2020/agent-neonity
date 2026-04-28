export type Column = {
  id: string
  board_id: string
  name: string
  color: string
  order: number
}

export type Task = {
  id: string
  board_id: string
  title: string
  description: string | null
  column_id: string
  order: number
  created_at: string
  updated_at: string
}

export type Board = {
  id: string
  name: string
  description: string | null
  created_at: string
}

export type TaskWithColumn = Task & {
  column: Column
}
