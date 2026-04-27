import { notFound } from "next/navigation";
import { chapters, getChapter } from "@/lib/chapters";
import { ChapterNav } from "@/components/chapter-nav";
import type { Metadata } from "next";

// Tell Next.js which slugs to pre-render
export function generateStaticParams() {
  return chapters.map((ch) => ({ slug: ch.slug }));
}

// Dynamic metadata
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const chapter = getChapter(slug);
  if (!chapter) return { title: "Not Found" };
  return {
    title: `${chapter.title} — Neonity Tutorial`,
    description: chapter.description,
  };
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const chapter = getChapter(slug);
  if (!chapter) notFound();

  // Dynamically import the chapter content
  let Content: React.ComponentType;
  try {
    const mod = await import(`@/content/chapters/${slug}.tsx`);
    Content = mod.default;
  } catch {
    return (
      <div className="py-12 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">
          Content Not Ready
        </h1>
        <p className="text-slate-400">
          This chapter&apos;s content hasn&apos;t been written yet.
        </p>
        <div className="mt-6">
          <ChapterNav slug={slug} />
        </div>
      </div>
    );
  }

  return (
    <article>
      {/* Chapter header */}
      <header className="mb-8">
        <p className="text-xs font-mono text-slate-600 mb-2">
          Chapter {String(chapter.order).padStart(2, "0")}
        </p>
        <h1 className="text-3xl font-bold text-white">{chapter.title}</h1>
        <p className="text-slate-400 mt-2">{chapter.description}</p>
      </header>

      {/* Chapter content */}
      <div className="prose-custom">
        <Content />
      </div>

      {/* Navigation */}
      <ChapterNav slug={slug} />
    </article>
  );
}
