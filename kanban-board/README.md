# Kanban Board

A project management application built with Next.js 16, shadcn/ui, and Supabase.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI Components**: shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS v4
- **Language**: TypeScript

## Getting Started

### 1. Set up Supabase

1. Create a new project at [Supabase](https://supabase.com)
2. Go to **SQL Editor** in your Supabase dashboard
3. Run the schema from `supabase/schema.sql`
4. Go to **Settings > API** and copy:
   - `Project URL`
   - `anon public` key

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Features

- **Kanban Board**: Visual task board with columns (Backlog, To Do, In Progress, Done)
- **Task Management**: Create, edit, and delete tasks
- **Drag and Drop**: Move tasks between columns
- **Persistent Storage**: All data stored in Supabase
- **Responsive Design**: Works on desktop and mobile
- **Dark Mode**: Supports system dark mode
- **User Authentication**: Sign up/login with email, Google OAuth, or magic link
- **AI Project Planner**: Describe your goal and AI suggests tasks to add to your board

## Project Structure

```
kanban-board/
├── src/
│   ├── app/
│   │   ├── globals.css      # Global styles
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Main page
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   ├── header.tsx       # App header
│   │   ├── kanban-board.tsx # Main board component
│   │   ├── kanban-column.tsx # Column component
│   │   ├── task-card.tsx    # Task card component
│   │   └── task-dialog.tsx  # Task edit/create dialog
│   ├── lib/
│   │   ├── supabase/        # Supabase client setup
│   │   └── utils.ts         # Utility functions
│   └── types/
│       └── kanban.ts        # TypeScript types
├── supabase/
│   └── schema.sql           # Database schema
├── .env.example             # Environment template
└── package.json
```

## Database Schema

The application uses two main tables:

- **columns**: Board columns (id, name, color, order)
- **tasks**: Task cards (id, title, description, column_id, order, timestamps)

RLS (Row Level Security) is enabled for production use. For development, all policies allow public access.