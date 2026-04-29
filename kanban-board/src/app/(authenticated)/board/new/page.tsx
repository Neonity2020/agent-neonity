"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Layers, Loader2, Sparkles, Wand2 } from "lucide-react"

export default function NewBoardPage() {
  const [name, setName] = useState("")
  const [aiPrompt, setAiPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<"manual" | "ai">("manual")
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

  const handleAICreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!aiPrompt.trim()) return

    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const response = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId: "new",
          request: aiPrompt,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "AI generation failed")

      const { boardSuggestion } = data
      if (!boardSuggestion) throw new Error("No board suggestion received")

      // 1. Create Board
      const { data: newBoard, error: boardError } = await supabase
        .from("boards")
        .insert({ 
          name: boardSuggestion.name || "New Project", 
          owner_id: user.id 
        })
        .select()
        .single()

      if (boardError || !newBoard) {
        console.error("Board creation error:", boardError)
        throw new Error("Failed to create board record")
      }

      // 2. Create Columns
      const columnsToInsert = (boardSuggestion.columns || []).map((c: any, index: number) => ({
        board_id: newBoard.id,
        name: c.name,
        color: c.color || "#6b7280",
        order: typeof c.order === 'number' ? c.order : index
      }))

      if (columnsToInsert.length === 0) {
        // Fallback to default columns if AI failed to suggest any
        columnsToInsert.push(
          { board_id: newBoard.id, name: "To Do", color: "#3b82f6", order: 0 },
          { board_id: newBoard.id, name: "Done", color: "#22c55e", order: 1 }
        )
      }

      const { data: createdColumns, error: columnsError } = await supabase
        .from("columns")
        .insert(columnsToInsert)
        .select()

      if (columnsError || !createdColumns || createdColumns.length === 0) {
        console.error("Columns creation error:", columnsError)
        throw new Error("Failed to create board columns")
      }

      // 3. Create Tasks
      if (boardSuggestion.tasks && Array.isArray(boardSuggestion.tasks) && boardSuggestion.tasks.length > 0) {
        const tasksToInsert = boardSuggestion.tasks.map((t: any, index: number) => {
          // Robust column matching
          let column = createdColumns.find(c => c.name === t.column_name)
          if (!column) {
            const normName = (t.column_name || "").trim().toLowerCase()
            column = createdColumns.find(c => c.name.trim().toLowerCase() === normName)
          }
          
          return {
            board_id: newBoard.id,
            column_id: column?.id || createdColumns[0].id,
            title: t.title || "Untitled Task",
            description: t.description || null,
            order: typeof t.order === 'number' ? t.order : index,
          }
        })

        const { error: tasksError } = await supabase
          .from("tasks")
          .insert(tasksToInsert)
        
        if (tasksError) {
          console.error("Tasks insertion error:", tasksError)
          // We don't throw here, as the board and columns are already created
        }
      }

      router.push(`/board/${newBoard.id}`)
    } catch (err) {
      console.error("Full AI Create Error:", err)
      setError(err instanceof Error ? err.message : "Failed to generate board")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
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
          <div className="flex bg-muted p-1 rounded-lg mb-6">
            <button
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === "manual" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMode("manual")}
            >
              Manual
            </button>
            <button
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                mode === "ai" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMode("ai")}
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI Generate
            </button>
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-4">
              {error}
            </div>
          )}

          {mode === "manual" ? (
            <form onSubmit={handleCreateBoard} className="space-y-4">
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
          ) : (
            <form onSubmit={handleAICreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prompt">Describe your project</Label>
                <Textarea
                  id="prompt"
                  placeholder="e.g. A personal workout tracker with weekly routines and progress tracking..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={4}
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={loading || !aiPrompt.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Generate Board
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

