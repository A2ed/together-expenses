import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";
export const categories = [
  "Groceries",
  "Eating out",
  "Shopping",
  "Bills",
  "Other",
];
export function merchantKey(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/^(sq \*|tst-)/, "")
    .replace(/\*.*$/, "")
    .replace(/^#\d+\s+/, "")
    .replace(/#\d+.*$/, "")
    .replace(/\s+\d+[\w -]*$/, "")
    .replace(/\s+-\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}
export function classify(description, credit = false) {
  const s = description.toLowerCase();
  if (credit && /royal bank|payment|thank you|paiement/.test(s))
    return { category: "Other", kind: "payment", source: "rule" };
  const rules = [
    [
      "Groceries",
      /thrifty|save on foods|whole foods|galey farms|mount douglas market|old country market|general store|superstore|fairway|safeway|country grocer/,
    ],
    [
      "Eating out",
      /coffee|starbucks|bakery|juice|tacofino|pizza|pizzeria|mcdonald|a\s?&\s?w|donuts|ice cream|restaurant|doordash|terrazzo|realm food|heal wellness/,
    ],
    [
      "Bills",
      /apple.com|telus|huggingface|appllama|kindle|netflix|spotify|hydro|insurance/,
    ],
    [
      "Shopping",
      /amzn|amazon|staples|sport chek|old navy|hm ca|tailoring|boutique|canadian tire|samsung|dollarama|coombs emporium/,
    ],
  ];
  return {
    category: rules.find(([, re]) => re.test(s))?.[0] || "Other",
    kind: credit ? "refund" : "purchase",
    source: rules.some(([, re]) => re.test(s)) ? "rule" : "review",
  };
}
export function parseScotia(csv) {
  const required = [
    "Date",
    "Description",
    "Sub-description",
    "Status",
    "Type of Transaction",
    "Amount",
  ];
  let rows;
  try {
    rows = parse(csv, {
      bom: true,
      columns: (headers) => {
        if (required.some((h) => !headers.includes(h)))
          throw new Error("Missing Scotia columns");
        return headers;
      },
      skip_empty_lines: true,
      trim: true,
    });
  } catch {
    throw new Error(
      "Use the original Scotiabank CSV with Date, Description, Sub-description, Status, Type of Transaction and Amount columns.",
    );
  }
  if (!rows.length) throw new Error("This CSV has no transactions.");
  if (rows.length > 20000)
    throw new Error("Import up to 20,000 transactions at a time.");
  const occurrences = new Map();
  let pending = 0;
  const transactions = [];
  rows.forEach((row, i) => {
    if (row.Status.toLowerCase() !== "posted") {
      pending++;
      return;
    }
    const date = row.Date;
    const numeric = row.Amount.replace(/[$,]/g, "");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date ||
      !row.Description ||
      !/^-?\d+(\.\d{1,2})?$/.test(numeric) ||
      !["Debit", "Credit"].includes(row["Type of Transaction"])
    )
      throw new Error(
        `Invalid date, merchant, type or amount on row ${i + 2}. Nothing was imported.`,
      );
    const credit = row["Type of Transaction"] === "Credit";
    const cents =
      Math.round(Math.abs(Number(numeric)) * 100) * (credit ? -1 : 1);
    if (!Number.isSafeInteger(cents) || Math.abs(cents) > 100000000)
      throw new Error(`Amount out of range on row ${i + 2}.`);
    const raw = JSON.stringify([
      date,
      row.Description.toLowerCase(),
      row["Sub-description"].toLowerCase(),
      cents,
    ]);
    const occurrence = (occurrences.get(raw) || 0) + 1;
    occurrences.set(raw, occurrence);
    transactions.push({
      id: createHash("sha256")
        .update(raw + ":" + occurrence)
        .digest("hex"),
      date,
      merchant: row.Description.trim(),
      detail: row["Sub-description"],
      cents,
      ...classify(row.Description, credit),
      merchant_key: merchantKey(row.Description),
    });
  });
  return { transactions, pending };
}
export function weekStart(date) {
  const d = new Date(date + "T12:00:00Z");
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function summarize(rows, threshold = 35000) {
  const spend = rows.filter((r) => r.kind !== "payment");
  const group = (key) => {
    const result = {};
    for (const r of spend) {
      const k = key(r);
      result[k] = (result[k] || 0) + r.cents;
    }
    return result;
  };
  return {
    currency: "CAD",
    netCents: spend.reduce((s, r) => s + r.cents, 0),
    count: spend.length,
    categories: group((r) => r.category),
    months: group((r) => r.date.slice(0, 7)),
    weeks: group((r) => weekStart(r.date)),
    categoryWeeks: group((r) => `${weekStart(r.date)} | ${r.category}`),
    categoryMonths: group((r) => `${r.date.slice(0, 7)} | ${r.category}`),
    merchants: group((r) => r.merchant),
    large: spend
      .filter((r) => r.cents > threshold)
      .map((r) => ({
        date: r.date,
        merchant: r.merchant,
        cents: r.cents,
        category: r.category,
      })),
    coverage: rows.length
      ? {
          from: rows.map((r) => r.date).sort()[0],
          to: rows
            .map((r) => r.date)
            .sort()
            .at(-1),
        }
      : null,
  };
}
