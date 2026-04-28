import type { Tool } from "../types.js";

/**
 * GitHub tool - integrates with GitHub API for repository operations.
 *
 * Features:
 * - Search repositories
 * - Get repository information
 * - List issues and pull requests
 * - Get file contents
 * - Create issues
 * - Post comments
 *
 * Environment variables:
 * - GITHUB_TOKEN: Personal access token for API requests
 */
export class GitHubTool implements Tool {
  readonly name = "github";
  readonly description =
    "Interact with GitHub API. Search repos, get repo info, list issues/PRs, view files, create issues, post comments. Requires GITHUB_TOKEN environment variable.";
  readonly inputSchema: Tool["inputSchema"] = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [
          "search-repos",
          "get-repo",
          "list-issues",
          "list-prs",
          "get-file",
          "create-issue",
          "post-comment",
        ],
        description: "The GitHub action to perform",
      },
      query: {
        type: "string",
        description: "Search query (for search-repos action)",
      },
      owner: {
        type: "string",
        description: "Repository owner (for repo-specific actions)",
      },
      repo: {
        type: "string",
        description: "Repository name (for repo-specific actions)",
      },
      issue_number: {
        type: "number",
        description: "Issue/PR number (for get-issue, post-comment actions)",
      },
      title: {
        type: "string",
        description: "Issue title (for create-issue action)",
      },
      body: {
        type: "string",
        description: "Issue body or comment content",
      },
      state: {
        type: "string",
        enum: ["open", "closed", "all"],
        description: "Filter by state (for list-issues, list-prs)",
      },
      path: {
        type: "string",
        description: "File path (for get-file action)",
      },
      ref: {
        type: "string",
        description: "Branch/tag/commit (for get-file action, default: main)",
      },
      per_page: {
        type: "number",
        description: "Results per page (default: 10, max: 100)",
      },
    },
    required: ["action"],
  };

  private baseURL = "https://api.github.com";

  private getHeaders(): Record<string, string> {
    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    const action = input.action as string;

    try {
      switch (action) {
        case "search-repos":
          return await this.searchRepos(input.query as string, input.per_page as number);
        case "get-repo":
          return await this.getRepo(input.owner as string, input.repo as string);
        case "list-issues":
          return await this.listIssues(
            input.owner as string,
            input.repo as string,
            input.state as string,
            input.per_page as number
          );
        case "list-prs":
          return await this.listPRs(
            input.owner as string,
            input.repo as string,
            input.state as string,
            input.per_page as number
          );
        case "get-file":
          return await this.getFile(
            input.owner as string,
            input.repo as string,
            input.path as string,
            input.ref as string
          );
        case "create-issue":
          return await this.createIssue(
            input.owner as string,
            input.repo as string,
            input.title as string,
            input.body as string
          );
        case "post-comment":
          return await this.postComment(
            input.owner as string,
            input.repo as string,
            input.issue_number as number,
            input.body as string
          );
        default:
          return JSON.stringify({ error: `Unknown action: ${action}` }, null, 2);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: `GitHub API error: ${message}` }, null, 2);
    }
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    // Handle empty response
    const text = await response.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  }

  private async searchRepos(query: string, per_page = 10): Promise<string> {
    const params = new URLSearchParams({
      q: query,
      per_page: String(Math.min(per_page, 100)),
    });

    const data = await this.request<{
      total_count: number;
      items: Array<{
        full_name: string;
        description: string | null;
        stars: number;
        language: string | null;
        owner: { login: string };
        html_url: string;
      }>;
    }>(`/search/repositories?${params.toString()}`);

    return JSON.stringify(
      {
        total: data.total_count,
        repos: data.items.map((r) => ({
          name: r.full_name,
          description: r.description,
          stars: r.stars,
          language: r.language,
          url: r.html_url,
        })),
      },
      null,
      2
    );
  }

  private async getRepo(owner: string, repo: string): Promise<string> {
    const data = await this.request<{
      full_name: string;
      description: string | null;
      stargazers_count: number;
      forks_count: number;
      open_issues_count: number;
      language: string | null;
      default_branch: string;
      html_url: string;
      created_at: string;
      pushed_at: string;
    }>(`/repos/${owner}/${repo}`);

    return JSON.stringify(
      {
        name: data.full_name,
        description: data.description,
        stars: data.stargazers_count,
        forks: data.forks_count,
        openIssues: data.open_issues_count,
        language: data.language,
        defaultBranch: data.default_branch,
        url: data.html_url,
        created: data.created_at,
        lastPush: data.pushed_at,
      },
      null,
      2
    );
  }

  private async listIssues(
    owner: string,
    repo: string,
    state = "open",
    per_page = 10
  ): Promise<string> {
    const params = new URLSearchParams({
      state,
      per_page: String(Math.min(per_page, 100)),
      sort: "updated",
      direction: "desc",
    });

    const data = await this.request<
      Array<{
        number: number;
        title: string;
        state: string;
        user: { login: string };
        labels: Array<{ name: string }>;
        created_at: string;
        updated_at: string;
        html_url: string;
      }>
    >(`/repos/${owner}/${repo}/issues?${params.toString()}`);

    return JSON.stringify(
      {
        count: data.length,
        issues: data.map((i) => ({
          number: i.number,
          title: i.title,
          state: i.state,
          author: i.user.login,
          labels: i.labels.map((l) => l.name),
          created: i.created_at,
          updated: i.updated_at,
          url: i.html_url,
        })),
      },
      null,
      2
    );
  }

  private async listPRs(
    owner: string,
    repo: string,
    state = "open",
    per_page = 10
  ): Promise<string> {
    const params = new URLSearchParams({
      state,
      per_page: String(Math.min(per_page, 100)),
      sort: "updated",
      direction: "desc",
    });

    const data = await this.request<
      Array<{
        number: number;
        title: string;
        state: string;
        user: { login: string };
        draft: boolean;
        head: { ref: string };
        base: { ref: string };
        created_at: string;
        updated_at: string;
        html_url: string;
      }>
    >(`/repos/${owner}/${repo}/pulls?${params.toString()}`);

    return JSON.stringify(
      {
        count: data.length,
        pullRequests: data.map((pr) => ({
          number: pr.number,
          title: pr.title,
          state: pr.state,
          author: pr.user.login,
          draft: pr.draft,
          head: pr.head.ref,
          base: pr.base.ref,
          created: pr.created_at,
          updated: pr.updated_at,
          url: pr.html_url,
        })),
      },
      null,
      2
    );
  }

  private async getFile(
    owner: string,
    repo: string,
    path: string,
    ref = "main"
  ): Promise<string> {
    const data = await this.request<{
      content?: string;
      encoding?: string;
      size?: number;
      sha: string;
    }>(`/repos/${owner}/${repo}/contents/${path}?ref=${ref}`);

    // Content comes base64 encoded
    if (data.encoding === "base64" && data.content) {
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      return JSON.stringify(
        {
          path,
          ref,
          size: data.size,
          sha: data.sha,
          content,
        },
        null,
        2
      );
    }

    return JSON.stringify(
      {
        path,
        ref,
        sha: data.sha,
        content: data.content,
      },
      null,
      2
    );
  }

  private async createIssue(
    owner: string,
    repo: string,
    title: string,
    body?: string
  ): Promise<string> {
    const data = await this.request<{
      number: number;
      title: string;
      html_url: string;
      state: string;
    }>(`/repos/${owner}/${repo}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });

    return JSON.stringify(
      {
        success: true,
        number: data.number,
        title: data.title,
        url: data.html_url,
        state: data.state,
      },
      null,
      2
    );
  }

  private async postComment(
    owner: string,
    repo: string,
    issue_number: number,
    body: string
  ): Promise<string> {
    const data = await this.request<{
      id: number;
      html_url: string;
    }>(`/repos/${owner}/${repo}/issues/${issue_number}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });

    return JSON.stringify(
      {
        success: true,
        id: data.id,
        url: data.html_url,
      },
      null,
      2
    );
  }
}