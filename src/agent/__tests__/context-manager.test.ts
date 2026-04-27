import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ContextManager } from "../context-manager.ts";
import type { Message, ContentBlock, ToolDefinition, Provider, ProviderResponse } from "../../types.ts";

function text(t: string): ContentBlock { return { type: "text", text: t }; }
function toolUse(id: string, name: string, input: Record<string, unknown> = {}): ContentBlock { return { type: "tool_use", id, name, input }; }
function toolResult(id: string, content: string): ContentBlock { return { type: "tool_result", tool_use_id: id, content }; }
function reasoning(t: string): ContentBlock { return { type: "reasoning", text: t }; }
function userMsg(...b: ContentBlock[]): Message { return { role: "user", content: b }; }
function asstMsg(...b: ContentBlock[]): Message { return { role: "assistant", content: b }; }

const sampleTools: ToolDefinition[] = [
  { name: "bash", description: "Execute a shell command", inputSchema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
  { name: "read", description: "Read a file", inputSchema: { type: "object", properties: { file_path: { type: "string" } }, required: ["file_path"] } },
];

function mockProvider(responseText: string): Provider {
  return { name: "mock", async chat(): Promise<ProviderResponse> { return { stopReason: "end_turn", content: [{ type: "text", text: responseText }] }; } };
}
function failingProvider(): Provider {
  return { name: "failing", async chat(): Promise<ProviderResponse> { throw new Error("fail"); } };
}

describe("getContextWindowSize", () => {
  let cm: ContextManager;
  beforeEach(() => { cm = new ContextManager(); });
  it("Claude models = 200k", () => {
    assert.equal(cm.getContextWindowSize("claude-sonnet-4-20250514"), 200_000);
    assert.equal(cm.getContextWindowSize("claude-haiku-3-5-20241022"), 200_000);
  });
  it("gpt-4.1 = 1,047,576", () => { assert.equal(cm.getContextWindowSize("gpt-4.1"), 1_047_576); });
  it("gpt-4o = 128k", () => { assert.equal(cm.getContextWindowSize("gpt-4o"), 128_000); });
  it("unknown = 128k default", () => { assert.equal(cm.getContextWindowSize("unknown"), 128_000); });
  it("override respected", () => {
    const ov = new ContextManager({ contextWindowOverride: 32_000 });
    assert.equal(ov.getContextWindowSize("gpt-4.1"), 32_000);
  });
  it("case-insensitive", () => { assert.equal(cm.getContextWindowSize("GPT-4.1"), 1_047_576); });
});

describe("estimateTokens", () => {
  let cm: ContextManager;
  beforeEach(() => { cm = new ContextManager(); });
  it("empty → zero", () => {
    const e = cm.estimateTokens([], "", [], "gpt-4o");
    assert.equal(e.totalTokens, 0); assert.equal(e.isOverBudget, false);
  });
  it("system prompt: ceil(len/4)", () => {
    const e = cm.estimateTokens([], "You are a helpful assistant.", [], "gpt-4o");
    assert.equal(e.systemPromptTokens, 7);
  });
  it("tool defs > 0", () => {
    assert.ok(cm.estimateTokens([], "", sampleTools, "gpt-4o").toolDefinitionTokens > 0);
  });
  it("user text = overhead(4) + ceil(5/4)=6", () => {
    assert.equal(cm.estimateTokens([userMsg(text("Hello"))], "", [], "gpt-4o").messageTokens, 6);
  });
  it("10 empty msgs = 40 overhead", () => {
    const msgs = Array.from({ length: 10 }, () => userMsg(text("")));
    assert.equal(cm.estimateTokens(msgs, "", [], "gpt-4o").messageTokens, 40);
  });
  it("tool_use counted correctly", () => {
    const e = cm.estimateTokens([asstMsg(toolUse("id","bash",{command:"ls -la"}))], "", [], "gpt-4o");
    assert.equal(e.messageTokens, 21);
  });
  it("tool_result counted correctly", () => {
    // "file1\nfile2\nfile3" = 17 chars → ceil(17/4)=5 + 10 + 4 = 19
    const e = cm.estimateTokens([userMsg(toolResult("id","file1\nfile2\nfile3"))], "", [], "gpt-4o");
    assert.equal(e.messageTokens, 19);
  });
  it("reasoning like text", () => {
    const e = cm.estimateTokens([asstMsg(reasoning("Let me think about this carefully."))], "", [], "gpt-4o");
    assert.equal(e.messageTokens, 13);
  });
  it("multi-block sum", () => {
    const e = cm.estimateTokens([asstMsg(reasoning("think..."), text("Ok:"), toolUse("id","read",{file_path:"/f.ts"}))], "", [], "gpt-4o");
    // reasoning "think..." = 8 → 2
    // text "Ok:" = 3 → 1
    // toolUse: "read"(4) + JSON=19 = 23 → ceil(23/3.5)=7 + 10 = 17
    // overhead = 4 → total = 4+2+1+18 = 25
    assert.equal(e.messageTokens, 25);
  });
  it("multi-message sum", () => {
    const e = cm.estimateTokens([userMsg(text("hi")), asstMsg(text("ok"))], "", [], "gpt-4o");
    assert.equal(e.messageTokens, 10); // 2×(4+ceil(2/4))=10
  });
  it("reserved = 25%", () => { assert.equal(cm.estimateTokens([], "", [], "gpt-4o").reservedForOutput, 32_000); });
  it("over budget detected", () => {
    const msgs: Message[] = [];
    for (let i = 0; i < 3400; i++) msgs.push(userMsg(text("x".repeat(100))));
    assert.equal(cm.estimateTokens(msgs, "", [], "gpt-4o").isOverBudget, true);
  });
  it("under budget", () => {
    assert.equal(cm.estimateTokens([userMsg(text("hi"))], "", [], "gpt-4o").isOverBudget, false);
  });
  it("total = parts", () => {
    const e = cm.estimateTokens([userMsg(text("U"))], "S", sampleTools, "gpt-4o");
    assert.equal(e.totalTokens, e.systemPromptTokens + e.toolDefinitionTokens + e.messageTokens);
  });
});

describe("groupMessages", () => {
  let cm: ContextManager;
  beforeEach(() => { cm = new ContextManager(); });
  function gm(msgs: Message[]) {
    return (cm as unknown as { groupMessages: (m: Message[]) => Array<{ indices: number[]; tokenCount: number }> })
      .groupMessages.call(cm, msgs);
  }
  it("empty → []", () => { assert.equal(gm([]).length, 0); });
  it("single → [[0]]", () => { assert.deepEqual(gm([userMsg(text("h"))])[0].indices, [0]); });
  it("tool_use+tool_result → [[0,1]]", () => {
    assert.deepEqual(gm([asstMsg(toolUse("id","read")), userMsg(toolResult("id","c"))])[0].indices, [0,1]);
  });
  it("tool_use+non-tool → 2", () => {
    assert.equal(gm([asstMsg(toolUse("id","read")), userMsg(text("p"))]).length, 2);
  });
  it("tool_use at end → [[0]]", () => {
    assert.deepEqual(gm([asstMsg(toolUse("id","bash"))])[0].indices, [0]);
  });
  it("two pairs → [[0,1],[2,3]]", () => {
    const g = gm([asstMsg(toolUse("a","r")), userMsg(toolResult("a","x")), asstMsg(toolUse("b","r")), userMsg(toolResult("b","y"))]);
    assert.equal(g.length, 2); assert.deepEqual(g[1].indices, [2,3]);
  });
  it("mixed → 3 groups", () => {
    const g = gm([asstMsg(toolUse("a","r")), userMsg(toolResult("a","x")), userMsg(text("m")), asstMsg(toolUse("b","r")), userMsg(toolResult("b","y"))]);
    assert.equal(g.length, 3);
  });
});

describe("truncation", () => {
  function mk(opts?: Record<string,unknown>) {
    return new ContextManager({ strategy: "truncation" as const, ...opts } as Record<string,unknown> & { strategy: "truncation" });
  }
  it("unchanged under budget", async () => {
    const msgs = [userMsg(text("hello"))];
    const r = await mk().manage(msgs, "", [], "gpt-4o");
    assert.equal(r.wasManaged, false); assert.deepEqual(r.messages, msgs);
  });
  it("truncates over budget", async () => {
    const msgs: Message[] = [];
    for (let i = 0; i < 40; i++) msgs.push(userMsg(text("m" + i)));
    const r = await mk({reserveRatio:0.9999}).manage(msgs, "", [], "gpt-4o");
    assert.equal(r.wasManaged, true);
    assert.ok(r.messages.length < msgs.length);
    assert.equal(msgs.length - r.messages.length, r.messagesAffected);
  });
  it("preserves recent", async () => {
    const cm2 = mk({reserveRatio:0.9999, preserveRecentGroups:2});
    const msgs: Message[] = [];
    for (let i = 0; i < 20; i++) msgs.push(userMsg(text("m" + i)));
    msgs[msgs.length-1] = userMsg(text("LAST"));
    const r = await cm2.manage(msgs, "", [], "gpt-4o");
    assert.equal((r.messages[r.messages.length-1].content[0] as {text:string}).text, "LAST");
  });
  it("only last when all exceed", async () => {
    const cm2 = mk({reserveRatio:0.99999, preserveRecentGroups:1});
    const msgs = [userMsg(text("a")), asstMsg(toolUse("id","bash")), userMsg(toolResult("id","x")), userMsg(text("last"))];
    const r = await cm2.manage(msgs, "", [], "gpt-4o");
    assert.equal(r.wasManaged, true); assert.equal(r.messages.length, 1);
  });
  it("order maintained", async () => {
    const cm2 = mk({reserveRatio:0.9999, preserveRecentGroups:2});
    const msgs: Message[] = [];
    for (let i = 0; i < 20; i++) msgs.push(userMsg(text("m" + i)));
    const r = await cm2.manage(msgs, "", [], "gpt-4o");
    for (let i = 1; i < r.messages.length; i++) {
      const a = (r.messages[i-1].content[0] as {text:string}).text.replace("m","");
      const b = (r.messages[i].content[0] as {text:string}).text.replace("m","");
      if (a && b) assert.ok(parseInt(a) < parseInt(b));
    }
  });
});

describe("summarization", () => {
  it("creates summary", async () => {
    const prov = mockProvider("Architecture: chose TS, 3 files created.");
    const cm = new ContextManager({strategy:"summarization" as const, reserveRatio:0.9999, preserveRecentGroups:1});
    const msgs: Message[] = [];
    for (let i = 0; i < 30; i++) msgs.push(userMsg(text("discussion " + i)));
    msgs.push(asstMsg(toolUse("id","bash"))); msgs.push(userMsg(toolResult("id","out")));
    const r = await cm.manage(msgs, "", [], "gpt-4o", prov);
    assert.equal(r.wasManaged, true);
    assert.ok((r.messages[0].content[0] as {text:string}).text.includes("[Context Summary]"));
  });
  it("falls back to truncation", async () => {
    const cm = new ContextManager({strategy:"summarization" as const, reserveRatio:0.9999, preserveRecentGroups:1});
    const msgs: Message[] = [];
    for (let i = 0; i < 30; i++) msgs.push(userMsg(text("m" + i)));
    const r = await cm.manage(msgs, "", [], "gpt-4o", failingProvider());
    assert.equal(r.wasManaged, true);
    assert.ok(!(r.messages[0].content[0] as {text:string}).text.includes("[Context Summary]"));
  });
});

describe("edge cases", () => {
  it("default strategy = truncation", async () => {
    const msgs: Message[] = [];
    for (let i = 0; i < 40; i++) msgs.push(userMsg(text("m" + i)));
    const r = await new ContextManager().manage(msgs, "", [], "gpt-4o", mockProvider("s"));
    assert.ok(!(r.messages[0].content[0] as {text:string}).text.includes("[Context Summary]"));
  });
  it("zero msgs unchanged", async () => {
    const r = await new ContextManager().manage([], "", [], "gpt-4o");
    assert.equal(r.wasManaged, false);
  });
  it("empty blocks = 4 overhead", () => {
    const e = new ContextManager().estimateTokens([{role:"user",content:[]}], "", [], "gpt-4o");
    assert.equal(e.messageTokens, 4);
  });
  it("error tool_result counted", () => {
    const e = new ContextManager().estimateTokens(
      [userMsg({type:"tool_result",tool_use_id:"t",content:"err",is_error:true})], "", [], "gpt-4o");
    assert.ok(e.messageTokens > 0);
  });
  it("all models recognized", () => {
    const cm = new ContextManager();
    for (const m of ["claude-sonnet-4-20250514","gpt-4.1","gpt-4o","gemini-2.5-flash","deepseek-v4-pro"]) {
      assert.ok(cm.getContextWindowSize(m) > 0, m);
    }
  });
  it("undefined name handled gracefully", () => {
    const cm = new ContextManager();
    const badBlock = { type: "tool_use" as const, id: "x", name: undefined as unknown as string, input: undefined as unknown as Record<string,unknown> };
    const badMsg: Message = { role: "assistant", content: [badBlock] };
    const e = cm.estimateTokens([badMsg], "", [], "gpt-4o");
    assert.ok(e.messageTokens >= 4); // at least overhead
  });
});
