export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api").replace(/\/$/, "");
export type User = { id: string; name: string; email: string };
export type Share = { user: User; role: "viewer" | "editor" };
export type Doc = { _id: string; title: string; content: Record<string, unknown>; owner: User; shares: Share[]; updatedAt: string; createdAt: string; accessRole?: "owner" | "viewer" | "editor" };
export async function request<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) }, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `Request failed (${response.status})`);
  return body as T;
}
export const emptyContent = { type: "doc", content: [{ type: "paragraph" }] };
export function plainTextToContent(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  return { type: "doc", content: (lines.length ? lines : [""]).map((line) => line.startsWith("# ") ? ({ type: "heading", attrs: { level: 1 }, content: line.slice(2) ? [{ type: "text", text: line.slice(2) }] : [] }) : ({ type: "paragraph", ...(line ? { content: [{ type: "text", text: line }] } : {}) })) };
}
