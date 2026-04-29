import { NextRequest, NextResponse } from "next/server"
import { suggestTodos, createTasksFromSuggestions } from "@/lib/ai/planner"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { boardId, request: userRequest, provider } = body

    if (!boardId || !userRequest) {
      return NextResponse.json(
        { error: "Missing required fields: boardId, request" },
        { status: 400 }
      )
    }

    // Get API key from environment (server-side only)
    const apiKey = process.env.BIGMODEL_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || ""

    if (!apiKey) {
      return NextResponse.json(
        { error: "AI API key not configured. Please set BIGMODEL_API_KEY, ANTHROPIC_API_KEY or OPENAI_API_KEY in your environment." },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const result = await suggestTodos(boardId, userRequest, apiKey, provider || "bigmodel", supabase)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      suggestions: result.suggestions,
      boardSuggestion: result.boardSuggestion,
    })
  } catch (error) {
    console.error("Plan API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { boardId, suggestions } = body

    if (!boardId || !suggestions || !Array.isArray(suggestions)) {
      return NextResponse.json(
        { error: "Missing required fields: boardId, suggestions (array)" },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const result = await createTasksFromSuggestions(boardId, suggestions, supabase)

    return NextResponse.json({
      success: true,
      created: result.created,
      failed: result.failed,
    })
  } catch (error) {
    console.error("Create tasks API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
