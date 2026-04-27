import Link from "next/link";
import { getAdjacentChapters } from "@/lib/chapters";

interface ChapterNavProps {
  slug: string;
}

export function ChapterNav({ slug }: ChapterNavProps) {
  const { prev, next } = getAdjacentChapters(slug);

  return (
    <nav className="flex justify-between mt-12 pt-6 border-t border-slate-800">
      <div>
        {prev ? (
          <Link
            href={`/chapters/${prev.slug}`}
            className="group flex flex-col gap-1"
          >
            <span className="text-xs text-slate-500">← Previous</span>
            <span className="text-sm text-slate-400 group-hover:text-cyan-400 transition-colors">
              {prev.title}
            </span>
          </Link>
        ) : (
          <Link href="/" className="group flex flex-col gap-1">
            <span className="text-xs text-slate-500">← Home</span>
            <span className="text-sm text-slate-400 group-hover:text-cyan-400 transition-colors">
              Overview
            </span>
          </Link>
        )}
      </div>
      <div className="text-right">
        {next ? (
          <Link
            href={`/chapters/${next.slug}`}
            className="group flex flex-col gap-1 items-end"
          >
            <span className="text-xs text-slate-500">Next →</span>
            <span className="text-sm text-slate-400 group-hover:text-cyan-400 transition-colors">
              {next.title}
            </span>
          </Link>
        ) : (
          <span className="text-xs text-slate-600">You&apos;ve reached the end 🎉</span>
        )}
      </div>
    </nav>
  );
}
