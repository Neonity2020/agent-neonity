"use client"

import Link from "next/link"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  CheckCircle2, 
  Layers, 
  Users, 
  Zap, 
  Shield, 
  BarChart3,
  ArrowRight,
  Star,
  Sparkles
} from "lucide-react"

export function LandingPage() {
  const { t } = useTranslation()

  const features = [
    { icon: Layers, title: t.landing.featureVisualTitle, description: t.landing.featureVisualDesc },
    { icon: Users, title: t.landing.featureCollabTitle, description: t.landing.featureCollabDesc },
    { icon: Zap, title: t.landing.featureRealtimeTitle, description: t.landing.featureRealtimeDesc },
    { icon: Shield, title: t.landing.featureSecureTitle, description: t.landing.featureSecureDesc },
    { icon: BarChart3, title: t.landing.featureTrackingTitle, description: t.landing.featureTrackingDesc },
    { icon: Sparkles, title: t.landing.featureAITitle, description: t.landing.featureAIDesc },
  ]

  const steps = [
    { step: 1, title: t.landing.step1Title, description: t.landing.step1Desc },
    { step: 2, title: t.landing.step2Title, description: t.landing.step2Desc },
    { step: 3, title: t.landing.step3Title, description: t.landing.step3Desc },
  ]

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Product Manager at TechCorp",
      content: "This Kanban board transformed how our team manages projects. It's intuitive and the collaboration features are top-notch.",
      rating: 5
    },
    {
      name: "Marcus Johnson",
      role: "Engineering Lead",
      content: "Finally, a project management tool that developers actually enjoy using. Clean interface, powerful features.",
      rating: 5
    },
    {
      name: "Emily Rodriguez",
      role: "Freelance Designer",
      content: "I use it for all my client projects. The ability to create multiple boards and collaborate with clients is invaluable.",
      rating: 5
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="border-b">
        <div className="container mx-auto px-4 flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">{t.header.kanban}</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm">{t.landing.logIn}</Button>
            </Link>
            <Link href="/login">
              <Button size="sm">{t.landing.getStarted}</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-sm text-muted-foreground mb-6">
            <Sparkles className="h-4 w-4" />
            {t.landing.badge}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            {t.landing.heroTitle1}<br />
            <span className="text-primary">{t.landing.heroTitle2}</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            {t.landing.heroDescription}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login">
              <Button size="lg" className="w-full sm:w-auto">
                {t.landing.startForFree}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                {t.landing.viewDemo}
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {t.landing.noCreditCard}
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              {t.landing.featuresTitle}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t.landing.featuresSubtitle}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-none shadow-sm">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              {t.landing.howItWorksTitle}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t.landing.howItWorksSubtitle}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((item) => (
              <div key={item.step} className="text-center">
                <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              {t.landing.testimonialsTitle}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t.landing.testimonialsSubtitle}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-lg mb-4">&ldquo;{testimonial.content}&rdquo;</p>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="border-none bg-primary text-primary-foreground">
            <CardContent className="py-16 text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                {t.landing.ctaTitle}
              </h2>
              <p className="text-xl opacity-90 max-w-2xl mx-auto mb-8">
                {t.landing.ctaDescription}
              </p>
              <Link href="/login">
                <Button size="lg" variant="secondary" className="text-primary">
                  {t.landing.ctaButton}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              <span className="font-semibold">{t.header.kanban}</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="#" className="hover:text-foreground">{t.landing.footerAbout}</Link>
              <Link href="#" className="hover:text-foreground">{t.landing.footerFeatures}</Link>
              <Link href="#" className="hover:text-foreground">{t.landing.footerPricing}</Link>
              <Link href="#" className="hover:text-foreground">{t.landing.footerContact}</Link>
            </div>
            <p className="text-sm text-muted-foreground">
              {t.landing.footerCopyright}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
