import type { Tool } from "../types.js";

/** Hacker News 帖子原始数据结构（来自 Firebase API） */
interface HnStory {
  id: number;
  title: string;
  url?: string;
  score: number;
  by: string;
  time: number; // Unix 时间戳（秒）
  descendants?: number; // 评论数
  type: string;
}

/**
 * Hacker News 热帖工具
 * 调用 HN Firebase API 获取排行榜数据，并发请求每条帖子详情，
 * 返回结构化 JSON 供 agent 格式化输出。
 *
 * API 无需认证，免费公开。
 */
export class HnTool implements Tool {
  readonly name = "hn-top";
  readonly description =
    "获取 Hacker News 热门帖子。返回排名、标题、链接、分数、评论数和作者。";
  readonly inputSchema: Tool["inputSchema"] = {
    type: "object",
    properties: {
      count: {
        type: "number",
        description: "获取帖数（默认 10，最大 30）",
      },
    },
    required: [],
  };

  async execute(input: Record<string, unknown>): Promise<string> {
    // 限制数量范围 [1, 30]
    const count = Math.min(
      Math.max((input.count as number) ?? 10, 1),
      30
    );

    try {
      // 第一步：获取热帖 ID 列表
      const topRes = await fetch(
        "https://hacker-news.firebaseio.com/v0/topstories.json"
      );
      if (!topRes.ok) {
        return JSON.stringify({ error: `HN API 请求失败: ${topRes.status}` }, null, 2);
      }
      const ids = (await topRes.json()) as number[];
      const topIds = ids.slice(0, count);

      // 第二步：并发获取每条帖子详情
      const stories = await Promise.all(
        topIds.map(async (id, index) => {
          const itemRes = await fetch(
            `https://hacker-news.firebaseio.com/v0/item/${id}.json`
          );
          if (!itemRes.ok) return null;
          const story = (await itemRes.json()) as HnStory | null;
          if (!story) return null;
          // Ask HN 类帖子没有外部链接，指向 HN 本身
          return {
            rank: index + 1,
            title: story.title,
            url: story.url ?? `https://news.ycombinator.com/item?id=${story.id}`,
            score: story.score,
            comments: story.descendants ?? 0,
            author: story.by,
            time: new Date(story.time * 1000).toISOString(),
          };
        })
      );

      // 过滤掉失败的请求
      const valid = stories.filter(Boolean);
      return JSON.stringify({ stories: valid }, null, 2);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: `获取 HN 热帖失败: ${msg}` }, null, 2);
    }
  }
}
