"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { chapters } from "@/lib/chapters";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-screen sticky top-0 border-r border-slate-800 bg-slate-950 flex flex-col">
      {/* Logo / Home */}
      <div className="p-5 border-b border-slate-800">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-2xl">⚡</span>
          <span className="font-bold text-lg text-white group-hover:text-cyan-400 transition-colors">
            Neonity
          </span>
        </Link>
        <p className="text-xs text-slate-500 mt-1">Tutorial</p>
      </div>

      {/* Chapter list */}
      <nav className="flex-1 overflow-y-auto p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Chapters
        </p>
        <ul className="space-y-0.5">
          {chapters.map((ch) => {
            const href = `/chapters/${ch.slug}`;
            const isActive = pathname === href;
            return (
              <li key={ch.slug}>
                <Link
                  href={href}
                  className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? "bg-cyan-500/10 text-cyan-400 font-medium"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <span className="text-xs text-slate-600 mr-2">
                    {String(ch.order).padStart(2, "0")}
                  </span>
                  {ch.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800">
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
        >
          Built with Next.js 16 + Shiki
        </a>
      </div>
    </aside>
  );
}
