export const categories = [
  "Groceries",
  "Eating out",
  "Shopping",
  "Bills",
  "Other",
] as const;
export type Category = (typeof categories)[number];
export type Transaction = {
  id: string;
  date: string;
  merchant: string;
  detail: string;
  cents: number;
  category: Category;
  kind: "purchase" | "refund" | "payment";
  source: string;
  merchant_key: string;
  note: string;
  version: number;
};
export type Settings = {
  householdName: string;
  cardName: string;
  cardLastFour: string;
  threshold: number;
  model: string;
  aiConfigured: boolean;
  reasoningEffort: string;
};
export type Data = {
  transactions: Transaction[];
  settings: Settings;
  imports: {
    id: number;
    name: string;
    added: number;
    skipped: number;
    created: string;
  }[];
  rules: { merchant_key: string; category: string }[];
};
export const colors: Record<Category, string> = {
  Groceries: "#a3e635",
  "Eating out": "#fb923c",
  Shopping: "#a78bfa",
  Bills: "#38bdf8",
  Other: "#71717a",
};
export const money = (cents: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(
    cents / 100,
  );
export const dateLabel = (
  date: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) => new Date(date + "T12:00:00").toLocaleDateString("en-CA", options);
export const monthLabel = (month: string) =>
  month === "all"
    ? "All history"
    : dateLabel(month + "-01", { month: "long", year: "numeric" });
export const merchantLabel = (s: string) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
export function weekStart(date: string) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export async function api<T = Record<string, unknown>>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const r = await fetch("/api" + url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) {
    if (r.status === 401 && url !== "/login")
      window.dispatchEvent(new Event("signed-out"));
    throw new Error(data.error || "Unable to complete this request.");
  }
  return data;
}
