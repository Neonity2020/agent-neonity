"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, Loader2 } from "lucide-react"
import Link from "next/link"

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  const errorMessages: Record<string, string> = {
    OAuthSignin: "Error starting OAuth sign in flow.",
    OAuthCallback: "Error during OAuth callback.",
    OAuthCreateAccount: "Error creating OAuth account.",
    EmailCreateAccount: "Error creating email account.",
    Callback: "Error in OAuth callback.",
    OAuthAccountLinked: "This account is already linked to another provider.",
    signin: "Error during sign in.",
    Signup: "Error during sign up.",
    token_request: "Error during token request.",
    token_refresh: "Error refreshing token.",
    session_required: "Your session has expired. Please sign in again.",
    default: "An authentication error occurred.",
  }

  const errorMessage = errorMessages[error || "default"] || errorMessages.default

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <CardTitle className="text-2xl font-bold text-destructive">Authentication Error</CardTitle>
        </div>
        <CardDescription>{errorMessage}</CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Link href="/login" className="text-primary hover:underline">
          Back to login page
        </Link>
      </CardContent>
    </Card>
  )
}

function AuthErrorLoading() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Loading...</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  )
}

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20">
      <Suspense fallback={<AuthErrorLoading />}>
        <AuthErrorContent />
      </Suspense>
    </div>
  )
}
