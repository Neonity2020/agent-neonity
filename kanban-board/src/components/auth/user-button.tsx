"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { User } from "@supabase/supabase-js"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LogOut, Settings, User as UserIcon, Loader2, Globe } from "lucide-react"

interface UserButtonProps {
  user?: User | null
}

export function UserButton({ user }: UserButtonProps) {
  const [signingOut, setSigningOut] = useState(false)
  const router = useRouter()
  const { t, locale, setLocale } = useTranslation()

  if (!user) return null

  const email = user.email || ""
  const displayName = user.user_metadata?.full_name || email.split("@")[0]
  const initials = displayName
    .split(/[\s.]+/)
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const handleSignOut = async () => {
    setSigningOut(true)
    await fetch("/api/auth/signout", { method: "POST" })
    window.location.href = "/login"
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" disabled={signingOut}>
          {signingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.user_metadata?.avatar_url} alt={displayName} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">{email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/profile")}>
          <Settings className="mr-2 h-4 w-4" />
          {t.userButton.settings}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/profile")}>
          <UserIcon className="mr-2 h-4 w-4" />
          {t.userButton.profile}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-normal text-xs text-muted-foreground flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5" />
          {t.userButton.language}
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setLocale("en")}>
          <span className={`mr-2 text-sm ${locale === "en" ? "font-bold" : ""}`}>
            {locale === "en" ? "✓" : "\u2003"}
          </span>
          English
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocale("zh-CN")}>
          <span className={`mr-2 text-sm ${locale === "zh-CN" ? "font-bold" : ""}`}>
            {locale === "zh-CN" ? "✓" : "\u2003"}
          </span>
          中文简体
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          {t.userButton.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

