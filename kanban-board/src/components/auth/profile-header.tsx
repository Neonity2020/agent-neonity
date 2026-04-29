"use client"

import { useTranslation } from "@/lib/i18n"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export function ProfileHeader() {
  const { t } = useTranslation()
  
  return (
    <>
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.profile.backToBoard}
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-6">{t.profile.title}</h1>
    </>
  )
}
