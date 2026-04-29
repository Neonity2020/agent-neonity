import { createClient } from "@/lib/supabase/client"
import { Column, Task, Board } from "@/types/kanban"

export interface BoardContext {
  board: Board
  columns: Column[]
  tasks: Task[]
}

export interface TodoSuggestion {
  title: string
  description?: string
  column_id: string
  reason: string
}

export interface BoardSuggestion {
  name: string
  columns: { name: string; color: string; order: number }[]
  tasks: { title: string; description?: string; column_name: string; order: number }[]
}

export interface PlanResult {
  success: boolean
  suggestions: TodoSuggestion[]
  boardSuggestion?: BoardSuggestion
  error?: string
}

/**
 * Get the full context of a board including columns and tasks
 */
export async function getBoardContext(boardId: string, supabaseClient?: any): Promise<BoardContext | null> {
  const supabase = supabaseClient || createClient()

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("*")
    .eq("id", boardId)
    .single()

  if (boardError || !board) return null

  const { data: columns } = await supabase
    .from("columns")
    .select("*")
    .eq("board_id", boardId)
    .order("order", { ascending: true })

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("board_id", boardId)
    .order("order", { ascending: true })

  return {
    board,
    columns: columns || [],
    tasks: tasks || [],
  }
}

/**
 * Generate a prompt for the AI to analyze the board and suggest todos
 */
function generatePrompt(context: BoardContext, userRequest: string): string {
  const columnNames = context.columns.map(c => c.name).join(", ")
  
  const tasksByColumn = context.columns.map(col => {
    const colTasks = context.tasks.filter(t => t.column_id === col.id)
    return `${col.name} (${colTasks.length} tasks): ${colTasks.length > 0 
      ? colTasks.map(t => `- ${t.title}${t.description ? `: ${t.description}` : ''}`).join('\n  ')
      : '(no tasks)'}`
  }).join('\n')

  return `
Analyze this Kanban board and suggest tasks for this request: "${userRequest}"

Board: "${context.board.name}"
Columns: ${columnNames}
Tasks:
${tasksByColumn}

Respond ONLY with a RAW JSON OBJECT. DO NOT use markdown code blocks. DO NOT include any text before or after the JSON.

Expected Format:
{
  "suggestions": [
    {
      "title": "Task title",
      "description": "Optional description",
      "column_id": "column-uuid-here",
      "reason": "Why this task is needed"
    }
  ]
}

JSON Response:
`
}

/**
 * Helper to extract JSON from AI response strings
 */
function extractJSON(text: string): any {
  try {
    // 1. Try to find JSON block in markdown
    const mdMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/)
    const target = mdMatch ? mdMatch[1] : text

    // 2. Try to find the largest { } or [ ] structure
    const firstBrace = target.indexOf('{')
    const lastBrace = target.lastIndexOf('}')
    const firstBracket = target.indexOf('[')
    const lastBracket = target.lastIndexOf(']')

    let start = -1
    let end = -1

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      start = firstBrace
      end = lastBrace
    } else if (firstBracket !== -1) {
      start = firstBracket
      end = lastBracket
    }

    if (start !== -1 && end !== -1 && end > start) {
      const jsonStr = target.substring(start, end + 1)
      return JSON.parse(jsonStr)
    }

    // 3. Last resort: try parsing the whole thing
    return JSON.parse(text)
  } catch (e) {
    console.error("JSON extraction failed:", e, "Original text:", text)
    return null
  }
}

/**
 * Parse the AI response to extract suggestions
 */
function parseAIResponse(response: string): TodoSuggestion[] {
  const parsed = extractJSON(response)
  if (parsed && parsed.suggestions && Array.isArray(parsed.suggestions)) {
    return parsed.suggestions
  }
  if (Array.isArray(parsed)) return parsed
  return []
}

function parseBoardResponse(response: string): BoardSuggestion | null {
  const parsed = extractJSON(response)
  if (parsed && parsed.name && Array.isArray(parsed.columns)) {
    return parsed
  }
  return null
}

/**
 * Use AI to analyze the board and suggest todos based on user request
 */
export async function suggestTodos(
  boardId: string | "new",
  userRequest: string,
  apiKey: string,
  provider: "openai" | "anthropic" | "bigmodel" = "bigmodel",
  supabaseClient?: any
): Promise<PlanResult> {
  if (boardId === "new") {
    return suggestNewBoard(userRequest, apiKey, provider)
  }

  const context = await getBoardContext(boardId, supabaseClient)
  
  if (!context) {
    return {
      success: false,
      suggestions: [],
      error: "Board not found"
    }
  }

  if (!userRequest.trim()) {
    return {
      success: false,
      suggestions: [],
      error: "Please provide a request"
    }
  }

  const prompt = generatePrompt(context, userRequest)

  try {
    let result: string

    if (provider === "openai") {
      const { generateText } = await import("ai")
      const { openai } = await import("@ai-sdk/openai")
      
      const { text } = await generateText({
        model: openai("gpt-4o"),
        prompt,
      })
      result = text
    } else if (provider === "bigmodel") {
      // Direct fetch to handle potentially non-standard "Anthropic-compatible" endpoint
      const response = await fetch("https://open.bigmodel.cn/api/anthropic/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "GLM-5.1",
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        }),
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`BigModel API error (${response.status}): ${errorData}`)
      }

      const data = await response.json()
      if (data.content && data.content[0] && data.content[0].text) {
        result = data.content[0].text
      } else {
        throw new Error("Unexpected response format from BigModel")
      }
    } else {
      const { generateText } = await import("ai")
      const { anthropic } = await import("@ai-sdk/anthropic")
      
      const { text } = await generateText({
        model: anthropic("claude-3-5-sonnet-20240620"),
        system: "You are a helpful project management assistant.",
        prompt,
      })
      result = text
    }

    const suggestions = parseAIResponse(result)

    return {
      success: true,
      suggestions,
    }
  } catch (error) {
    console.error("AI planning error:", error)
    return {
      success: false,
      suggestions: [],
      error: error instanceof Error ? error.message : "AI planning failed"
    }
  }
}

/**
 * Use AI to generate a full board structure from scratch
 */
async function suggestNewBoard(
  userRequest: string,
  apiKey: string,
  provider: "openai" | "anthropic" | "bigmodel"
): Promise<PlanResult> {
  const prompt = `
Generate a Kanban board structure based on this request: "${userRequest}"

Respond ONLY with a RAW JSON OBJECT. DO NOT use markdown code blocks. DO NOT include any text before or after the JSON.

Expected Format:
{
  "name": "Project Name",
  "columns": [
    { "name": "Column Name", "color": "#hexcolor", "order": 0 }
  ],
  "tasks": [
    { "title": "Task Title", "description": "Optional desc", "column_name": "Column Name", "order": 0 }
  ]
}

JSON Response:
`

  try {
    let result: string
    const { generateText } = await import("ai")

    if (provider === "openai") {
      const { openai } = await import("@ai-sdk/openai")
      const { text } = await generateText({ model: openai("gpt-4o"), prompt })
      result = text
    } else if (provider === "bigmodel") {
      // Direct fetch to handle potentially non-standard "Anthropic-compatible" endpoint
      const response = await fetch("https://open.bigmodel.cn/api/anthropic/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "GLM-5.1",
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        }),
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`BigModel API error (${response.status}): ${errorData}`)
      }

      const data = await response.json()
      if (data.content && data.content[0] && data.content[0].text) {
        result = data.content[0].text
      } else {
        throw new Error("Unexpected response format from BigModel")
      }
    } else {
      const { anthropic } = await import("@ai-sdk/anthropic")
      const { text } = await generateText({
        model: anthropic("claude-3-5-sonnet-20240620"),
        system: "You are a helpful project management assistant.",
        prompt,
      })
      result = text
    }

    const boardSuggestion = parseBoardResponse(result)

    if (!boardSuggestion) {
      return { success: false, suggestions: [], error: "Failed to parse board plan" }
    }

    return {
      success: true,
      suggestions: [],
      boardSuggestion,
    }
  } catch (error) {
    console.error("AI board planning error:", error)
    return {
      success: false,
      suggestions: [],
      error: error instanceof Error ? error.message : "AI planning failed"
    }
  }
}

/**
 * Create tasks from suggestions
 */
export async function createTasksFromSuggestions(
  boardId: string,
  suggestions: TodoSuggestion[],
  supabaseClient?: any
): Promise<{ created: number; failed: number }> {
  if (suggestions.length === 0) return { created: 0, failed: 0 }

  const supabase = supabaseClient || createClient()
  let created = 0
  let failed = 0

  for (const suggestion of suggestions) {
    // Get max order for the column
    const { data: existingTasks } = await supabase
      .from("tasks")
      .select("order")
      .eq("column_id", suggestion.column_id)
      .order("order", { ascending: false })
      .limit(1)

    const maxOrder = existingTasks?.[0]?.order ?? -1

    const { error } = await supabase
      .from("tasks")
      .insert({
        board_id: boardId,
        column_id: suggestion.column_id,
        title: suggestion.title,
        description: suggestion.description || null,
        order: maxOrder + 1,
      })

    if (error) {
      failed++
    } else {
      created++
    }
  }

  return { created, failed }
}
