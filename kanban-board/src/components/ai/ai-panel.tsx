"use client"

import { useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Column, Task } from "@/types/kanban"
import { Sparkles, Loader2, Plus, X, MessageSquare } from "lucide-react"

interface Suggestion {
  title: string
  description?: string
  column_id: string
  reason: string
}

interface AIPanelProps {
  boardId: string
  columns: Column[]
  onTasksCreated?: () => void
}

export function AIPanel({ boardId, columns, onTasksCreated }: AIPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [userRequest, setUserRequest] = useState("")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<"input" | "suggestions" | "loading">("input")

  const supabase = createClient()

  const handleSubmitRequest = async () => {
    if (!userRequest.trim()) return

    setLoading(true)
    setError(null)
    setStep("loading")

    try {
      const response = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId,
          request: userRequest,
          provider: "bigmodel",
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get suggestions")
      }

      setSuggestions(data.suggestions)
      // Select all suggestions by default
      setSelectedSuggestions(new Set(data.suggestions.map((_: any, i: number) => i)))
      setStep("suggestions")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setStep("input")
    } finally {
      setLoading(false)
    }
  }

  const handleToggleSuggestion = (index: number) => {
    const newSelected = new Set(selectedSuggestions)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedSuggestions(newSelected)
  }

  const handleCreateTasks = async () => {
    const tasksToCreate = suggestions.filter((_, i) => selectedSuggestions.has(i))

    if (tasksToCreate.length === 0) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/ai/plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId,
          suggestions: tasksToCreate,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create tasks")
      }

      setDialogOpen(false)
      setUserRequest("")
      setSuggestions([])
      setSelectedSuggestions(new Set())
      setStep("input")
      onTasksCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tasks")
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setUserRequest("")
    setSuggestions([])
    setSelectedSuggestions(new Set())
    setStep("input")
    setError(null)
  }

  const getColumnName = (columnId: string) => {
    const column = columns.find(c => c.id === columnId)
    return column?.name || "Unknown"
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Sparkles className="h-4 w-4" />
          AI Plan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Project Planner
          </DialogTitle>
          <DialogDescription>
            Describe what you want to accomplish and AI will suggest tasks for your board.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {error}
            </div>
          )}

          {step === "input" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="request">What do you want to accomplish?</Label>
                <Textarea
                  id="request"
                  value={userRequest}
                  onChange={(e) => setUserRequest(e.target.value)}
                  placeholder="e.g. I want to build a user authentication system with login, signup, and password reset..."
                  rows={4}
                />
              </div>
              <Button onClick={handleSubmitRequest} disabled={!userRequest.trim()} className="w-full">
                <Sparkles className="mr-2 h-4 w-4" />
                Get Task Suggestions
              </Button>
            </div>
          )}

          {step === "loading" && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">AI is analyzing your board and planning tasks...</p>
            </div>
          )}

          {step === "suggestions" && suggestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {suggestions.length} task{suggestions.length !== 1 ? "s" : ""} suggested
                </p>
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  Start Over
                </Button>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <Card 
                    key={index} 
                    className={`cursor-pointer transition-colors ${
                      selectedSuggestions.has(index) ? "border-primary bg-primary/5" : ""
                    }`}
                    onClick={() => handleToggleSuggestion(index)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedSuggestions.has(index)}
                          className="mt-1"
                          onCheckedChange={() => handleToggleSuggestion(index)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium">{suggestion.title}</p>
                            <Badge variant="secondary" className="text-xs">
                              {getColumnName(suggestion.column_id)}
                            </Badge>
                          </div>
                          {suggestion.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {suggestion.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground italic">
                            {suggestion.reason}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleReset}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateTasks}
                  disabled={loading || selectedSuggestions.size === 0}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Create {selectedSuggestions.size} Task{selectedSuggestions.size !== 1 ? "s" : ""}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === "suggestions" && suggestions.length === 0 && (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No new tasks needed for this request. Your board already has what it needs!
              </p>
              <Button variant="outline" onClick={handleReset} className="mt-4">
                Try Another Request
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
