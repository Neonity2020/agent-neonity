"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useTranslation } from "@/lib/i18n"
import { User } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Layers, Plus, Home, LogOut, Trash2 } from "lucide-react"
import Link from "next/link"
import { Board } from "@/types/kanban"
import { UserButton } from "@/components/auth/user-button"
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
} from "@/components/ui/dialog"

interface HeaderProps {
  currentBoardId?: string
  user?: User | null
}

export function Header({ currentBoardId, user }: HeaderProps) {
  const [boards, setBoards] = useState<Board[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()
  const { t } = useTranslation()

  useEffect(() => {
    fetchBoards()
  }, [])

  const fetchBoards = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return

    const { data } = await supabase
      .from("boards")
      .select("*")
      .eq("owner_id", currentUser.id)
      .order("created_at", { ascending: false })
      
    if (data) setBoards(data)
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProjectName.trim()) return
    
    setLoading(true)
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) throw new Error("Not authenticated")

      const { data: newBoard, error: boardError } = await supabase
        .from("boards")
        .insert({ name: newProjectName.trim(), owner_id: currentUser.id })
        .select()
        .single()
        
      if (boardError || !newBoard) throw boardError
      
      // Create default columns for the new board
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

  const handleDeleteBoard = async () => {
    if (!currentBoardId) return
    
    setDeleting(true)
    try {
      const { error } = await supabase
        .from("boards")
        .delete()
        .eq("id", currentBoardId)

      if (error) throw error

      setDeleteDialogOpen(false)
      
      // Navigate to next available board or create new
      const remaining = boards.filter(b => b.id !== currentBoardId)
      if (remaining.length > 0) {
        router.push(`/board/${remaining[0].id}`)
      } else {
        router.push("/board/new")
      }
      fetchBoards()
    } catch (error) {
      console.error("Error deleting board:", error)
    } finally {
      setDeleting(false)
    }
  }

  const currentBoard = boards.find(b => b.id === currentBoardId)

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <Home className="h-4 w-4" />
            <span className="text-sm">{t.header.home}</span>
          </Link>
          
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">{t.header.kanban}</h1>
          </div>
          
          <Select 
            value={currentBoardId} 
            onValueChange={(val) => router.push(`/board/${val}`)}
          >
            <SelectTrigger className="w-[200px] h-8 border-none bg-muted/50 focus:ring-0 focus:ring-offset-0">
              <SelectValue placeholder={t.header.selectProject} />
            </SelectTrigger>
            <SelectContent>
              {boards.map(board => (
                <SelectItem key={board.id} value={board.id}>
                  {board.name}
                </SelectItem>
              ))}
              {boards.length === 0 && (
                <SelectItem value="none" disabled>{t.header.noProjectsYet}</SelectItem>
              )}
            </SelectContent>
          </Select>
          {currentBoardId && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => setDeleteDialogOpen(true)}
              title={t.header.deleteBoard}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="default" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            {t.header.newProject}
          </Button>
          
          <UserButton user={user} />
          {user && (
            <Button size="sm" variant="outline" onClick={async () => {
              await fetch("/api/auth/signout", { method: "POST" })
              window.location.href = "/"
            }}>
              <LogOut className="h-4 w-4 mr-1" />
              {t.header.signOut}
            </Button>
          )}

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <form onSubmit={handleCreateProject}>
                <DialogHeader>
                  <DialogTitle>{t.createDialog.title}</DialogTitle>
                  <DialogDescription>
                    {t.createDialog.description}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">{t.createDialog.projectName}</Label>
                    <Input 
                      id="name" 
                      value={newProjectName} 
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder={t.createDialog.placeholder}
                      autoFocus
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    {t.createDialog.cancel}
                  </Button>
                  <Button type="submit" disabled={loading || !newProjectName.trim()}>
                    {loading ? t.createDialog.creating : t.createDialog.create}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t.deleteDialog.title}</DialogTitle>
                <DialogDescription>
                  {t.deleteDialog.description(currentBoard?.name || "")}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  {t.deleteDialog.cancel}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteBoard}
                  disabled={deleting}
                >
                  {deleting ? t.deleteDialog.deleting : t.deleteDialog.delete}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  )
}
