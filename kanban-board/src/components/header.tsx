"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Layers, Plus } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Board } from "@/types/kanban"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface HeaderProps {
  currentBoardId?: string
}

export function Header({ currentBoardId }: HeaderProps) {
  const [boards, setBoards] = useState<Board[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [loading, setLoading] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchBoards()
  }, [])

  const fetchBoards = async () => {
    const { data } = await supabase
      .from("boards")
      .select("*")
      .order("created_at", { ascending: false })
      
    if (data) setBoards(data)
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProjectName.trim()) return
    
    setLoading(true)
    try {
      const { data: newBoard, error: boardError } = await supabase
        .from("boards")
        .insert({ name: newProjectName.trim() })
        .select()
        .single()
        
      if (boardError || !newBoard) throw boardError
      
      setDialogOpen(false)
      setNewProjectName("")
      router.push(`/board/${newBoard.id}`)
      fetchBoards()
    } catch (error) {
      console.error("Error creating project:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Kanban</h1>
          </div>
          
          <Select 
            value={currentBoardId} 
            onValueChange={(val) => router.push(`/board/${val}`)}
          >
            <SelectTrigger className="w-[200px] h-8 border-none bg-muted/50 focus:ring-0 focus:ring-offset-0">
              <SelectValue placeholder="Select Project" />
            </SelectTrigger>
            <SelectContent>
              {boards.map(board => (
                <SelectItem key={board.id} value={board.id}>
                  {board.name}
                </SelectItem>
              ))}
              {boards.length === 0 && (
                <SelectItem value="none" disabled>No projects yet</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="default" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Project
          </Button>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <form onSubmit={handleCreateProject}>
                <DialogHeader>
                  <DialogTitle>Create New Project</DialogTitle>
                  <DialogDescription>
                    Create a new Kanban board to manage your tasks.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Project Name</Label>
                    <Input 
                      id="name" 
                      value={newProjectName} 
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="e.g. Website Redesign" 
                      autoFocus
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading || !newProjectName.trim()}>
                    {loading ? "Creating..." : "Create Project"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  )
}
