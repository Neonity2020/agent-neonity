import { codeToHtml } from "shiki";

interface CodeBlockProps {
  code: string;
  lang?: string;
  filename?: string;
}

export async function CodeBlock({ code, lang = "typescript", filename }: CodeBlockProps) {
  const html = await codeToHtml(code.trim(), {
    lang,
    themes: {
      light: "github-dark-default",
      dark: "github-dark-default",
    },
  });

  return (
    <div className="my-6 rounded-lg overflow-hidden border border-slate-700">
      {filename && (
        <div className="bg-slate-800 px-4 py-2 text-xs text-slate-400 font-mono border-b border-slate-700">
          {filename}
        </div>
      )}
      <div
        dangerouslySetInnerHTML={{ __html: html }}
        className="[&_pre]:!bg-transparent [&_pre]:p-4 [&_pre]:overflow-x-auto [&_code]:text-sm [&_code]:leading-relaxed"
      />
    </div>
  );
}
