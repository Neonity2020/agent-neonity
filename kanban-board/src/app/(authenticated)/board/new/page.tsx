"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Layers, Loader2 } from "lucide-react"

export default function NewBoardPage() {
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const { t } = useTranslation()

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Create the board with owner_id
      const { data: newBoard, error: boardError } = await supabase
        .from("boards")
        .insert({ name: name.trim(), owner_id: user.id })
        .select()
        .single()

      if (boardError || !newBoard) throw boardError

      // Create default columns
      const defaultColumns = [
        { name: "Backlog", color: "#6b7280", order: 0 },
        { name: "To Do", color: "#3b82f6", order: 1 },
        { name: "In Progress", color: "#f59e0b", order: 2 },
        { name: "Done", color: "#22c55e", order: 3 },
      ]

      const columnInserts = defaultColumns.map(col => ({
        board_id: newBoard.id,
        ...col
      }))

      const { error: columnsError } = await supabase
        .from("columns")
        .insert(columnInserts)

      if (columnsError) throw columnsError

      router.push(`/board/${newBoard.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create board")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Layers className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">{t.newBoard.title}</CardTitle>
          <CardDescription>
            {t.newBoard.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateBoard} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">{t.newBoard.projectName}</Label>
              <Input
                id="name"
                placeholder={t.newBoard.placeholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !name.trim()}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t.newBoard.creating}
                </>
              ) : (
                t.newBoard.createBoard
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
