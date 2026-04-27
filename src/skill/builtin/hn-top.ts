import type { Skill } from "../skill.js";
import { HnTool } from "../../tool/hn-tool.js";

export const hnTopSkill: Skill = {
  name: "hn-top",
  description: "获取并展示 Hacker News 热门帖子（分数、评论数等）。",
  defaultActive: false,
  tools: [new HnTool()],
  systemPrompt: `你可以使用 "hn-top" 工具获取 Hacker News 热门帖子。

当用户要求查看 HN 热帖、Hacker News 故事、或类似请求时：
1. 调用 hn-top，传入用户指定的数量（默认 10 条）。
2. 在终端中展示结果，每条帖子使用以下紧凑格式：
   {rank}. {title}
      {中文简要注释：用一句话概括帖子主题}
      {score} 分 | {comments} 评论 | 作者 {author} | {相对时间}
      {url}
3. 同时将结果保存为 Markdown 文件到项目的 hn-tops/ 目录下，文件名格式：YYYY-MM-DD.md（如 2026-04-27.md）。如果当天文件已存在则覆盖。
4. Markdown 文件格式如下，保留所有网址链接方便浏览：

   # Hacker News 热帖 - {YYYY-MM-DD}

   | # | 标题 | 分数 | 评论 | 作者 |
   |---|------|------|------|------|
   | 1 | [标题](原文链接) \| [HN讨论](HN链接) | {score} | {comments} | {author} |

5. 输出保持可读、简洁。`,
};
