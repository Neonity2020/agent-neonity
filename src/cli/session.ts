import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { Message } from "../types.js";

const NEONITY_DIR = path.join(os.homedir(), ".neonity");
const SESSIONS_DIR = path.join(NEONITY_DIR, "sessions");
const HISTORY_FILE = path.join(NEONITY_DIR, "history");

// Ensure directories exist
function ensureDirs(): void {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// --- History ---

export function loadHistory(): string[] {
  ensureDirs();
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, "utf-8");
      return data
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    }
  } catch {
    // Ignore errors
  }
  return [];
}

export function saveHistory(lines: string[]): void {
  ensureDirs();
  try {
    // Keep last 1000 entries
    const trimmed = lines.slice(-1000);
    fs.writeFileSync(HISTORY_FILE, trimmed.join("\n") + "\n", "utf-8");
  } catch {
    // Ignore errors
  }
}

// --- Sessions ---

export interface Session {
  name: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export function listSessions(): string[] {
  ensureDirs();
  try {
    return fs
      .readdirSync(SESSIONS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}

export function saveSession(name: string, messages: Message[]): void {
  ensureDirs();
  const filePath = path.join(SESSIONS_DIR, `${name}.json`);

  let session: Session;
  if (fs.existsSync(filePath)) {
    const existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    session = {
      ...existing,
      updatedAt: new Date().toISOString(),
      messages,
    };
  } else {
    session = {
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages,
    };
  }

  fs.writeFileSync(filePath, JSON.stringify(session, null, 2), "utf-8");
}

export function loadSession(name: string): Message[] | null {
  ensureDirs();
  const filePath = path.join(SESSIONS_DIR, `${name}.json`);
  try {
    if (fs.existsSync(filePath)) {
      const session: Session = JSON.parse(
        fs.readFileSync(filePath, "utf-8")
      );
      return session.messages;
    }
  } catch {
    // Ignore errors
  }
  return null;
}

export function deleteSession(name: string): boolean {
  ensureDirs();
  const filePath = path.join(SESSIONS_DIR, `${name}.json`);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch {
    // Ignore errors
  }
  return false;
}
