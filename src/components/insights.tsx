import { AiOrb } from "./ai-orb";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Clock3,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { api, colors, dateLabel, merchantLabel, money } from "@/lib/data";
import type { Category, Settings, Transaction } from "@/lib/data";
import { insightFacts, listPeriods } from "../../shared/analytics.ts";
import type { InsightFacts, PeriodUnit } from "../../shared/analytics.ts";
import { AnimatedAmount, DotLoader } from "./dashboard-details";
import { CumulativePlot, preferredAnchor } from "./spending-timeline";

type Visual = "categories" | "merchants" | "daily" | "comparison";
type Report = {
  title: string;
  summary: string;
  sections: { heading: string; body: string; visual: Visual }[];
  facts: InsightFacts;
  model: string;
  generatedAt: string;
  fingerprint: string;
};
type Saved = { report: Report | null; stale: boolean };
const tooltipStyle = {
  background: "#18181b",
  border: "1px solid #36363c",
  borderRadius: 8,
  fontSize: 11,
  color: "#fafafa",
};
const dollars = (c: number) =>
  Math.abs(c) >= 100000
    ? `$${(c / 100000).toFixed(1)}k`
    : `$${Math.round(c / 100)}`;
function ReportVisual({ type, facts }: { type: Visual; facts: InsightFacts }) {
  if (type === "comparison" && facts.cumulative)
    return (
      <div>
        <CumulativePlot data={facts.cumulative} compact />
        <div className="report-chart-caption">
          <span>
            <i style={{ background: "#a3e635" }} />
            Selected period
          </span>
          <span>
            <i style={{ background: "#777780" }} />
            Previous period
          </span>
        </div>
      </div>
    );
  if (type === "daily") {
    const data = facts.daily.map((d) => ({
      ...d,
      timestamp: Date.parse(d.date + "T12:00:00Z"),
    }));
    return (
      <div
        className="report-chart"
        role="img"
        aria-label="Daily net spending in CAD"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 12, right: 12, bottom: 10, left: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="#29292e"
              strokeDasharray="2 5"
            />
            <XAxis
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(t) =>
                dateLabel(new Date(t).toISOString().slice(0, 10))
              }
              tick={{ fill: "#71717a", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={dollars}
              tick={{ fill: "#71717a", fontSize: 10 }}
              width={54}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(t) =>
                dateLabel(new Date(Number(t)).toISOString().slice(0, 10))
              }
              formatter={(v) => [money(Number(v)), "Net spend"]}
            />
            <Area
              dataKey="cents"
              type="linear"
              stroke="#a78bfa"
              fill="#a78bfa"
              fillOpacity={0.09}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }
  const data =
    type === "categories"
      ? facts.categories.map((c) => ({
          label: c.category,
          cents: c.cents,
          color: colors[c.category as Category],
        }))
      : facts.merchants.slice(0, 6).map((m) => ({
          label: merchantLabel(m.merchant),
          cents: m.cents,
          color: "#a78bfa",
        }));
  return (
    <div
      className="report-chart"
      role="img"
      aria-label={`${type === "categories" ? "Category" : "Top merchant"} net spending in CAD`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 20, bottom: 5, left: 0 }}
          barSize={13}
        >
          <CartesianGrid
            horizontal={false}
            stroke="#29292e"
            strokeDasharray="2 5"
          />
          <XAxis
            type="number"
            tickFormatter={dollars}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#71717a", fontSize: 9 }}
          />
          <YAxis
            type="category"
            dataKey="label"
            axisLine={false}
            tickLine={false}
            width={108}
            tick={{ fill: "#a1a1aa", fontSize: 10 }}
            tickFormatter={(s) => (s.length > 19 ? s.slice(0, 18) + "…" : s)}
          />
          <Tooltip
            cursor={{ fill: "#ffffff04" }}
            contentStyle={tooltipStyle}
            formatter={(v) => [money(Number(v)), "Net spend"]}
          />
          <Bar dataKey="cents" radius={[0, 3, 3, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
function ReportData({ facts }: { facts: InsightFacts }) {
  return (
    <details className="report-data">
      <summary>View report data</summary>
      <div className="report-data-tables">
        <table>
          <caption>Categories</caption>
          <thead>
            <tr>
              <th>Category</th>
              <th>Net spend</th>
            </tr>
          </thead>
          <tbody>
            {facts.categories.map((c) => (
              <tr key={c.category}>
                <td>{c.category}</td>
                <td>{money(c.cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table>
          <caption>Top merchants</caption>
          <thead>
            <tr>
              <th>Merchant</th>
              <th>Net spend</th>
            </tr>
          </thead>
          <tbody>
            {facts.merchants.map((m) => (
              <tr key={m.merchant}>
                <td>{merchantLabel(m.merchant)}</td>
                <td>{money(m.cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table>
          <caption>Daily totals</caption>
          <thead>
            <tr>
              <th>Date</th>
              <th>Net spend</th>
            </tr>
          </thead>
          <tbody>
            {facts.daily.map((d) => (
              <tr key={d.date}>
                <td>{dateLabel(d.date)}</td>
                <td>{money(d.cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {facts.cumulative?.comparison.available && (
        <p>
          First {facts.cumulative.comparison.days} days:{" "}
          {money(facts.cumulative.comparison.currentCents!)} vs{" "}
          {money(facts.cumulative.comparison.previousCents!)} previously.
        </p>
      )}
    </details>
  );
}
export function Insights({
  rows,
  month,
  settings,
  onSettings,
}: {
  rows: Transaction[];
  month: string;
  settings: Settings;
  onSettings: () => void;
}) {
  const [unit, setUnit] = useState<PeriodUnit>(
      month === "all" ? "all" : "month",
    ),
    [choice, setChoice] = useState({ context: "", anchor: "" });
  const context = unit + month,
    anchor =
      choice.context === context
        ? choice.anchor
        : preferredAnchor(rows, unit === "all" ? "month" : unit, month);
  const facts = insightFacts(rows, unit, anchor, settings.threshold * 100),
    scopeKey = facts.period.key;
  const [saved, setSaved] = useState<Saved & { key: string }>({
      key: "",
      report: null,
      stale: false,
    }),
    [loading, setLoading] = useState(true),
    [generating, setGenerating] = useState(false),
    [error, setError] = useState("");
  const periods = unit === "all" ? [] : listPeriods(rows, unit);
  const revision =
    rows.map((r) => r.id + ":" + r.version).join("|") +
    ":" +
    settings.threshold;
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    api<Saved>(`/insights?unit=${unit}&anchor=${anchor}`)
      .then((result) => {
        if (current) setSaved({ ...result, key: scopeKey });
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [unit, anchor, scopeKey, revision]);
  const report = saved.key === scopeKey ? saved.report : null;
  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const result = await api<Saved>("/insights", "POST", { unit, anchor });
      setSaved({ ...result, key: scopeKey });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }
  return (
    <div className="insights-page">
      <div className="insights-toolbar">
        <div className="insight-period-picker">
          <select
            aria-label="Insights period type"
            value={unit}
            disabled={generating}
            onChange={(e) => setUnit(e.target.value as PeriodUnit)}
          >
            <option value="month">Monthly</option>
            <option value="week">Weekly</option>
            <option value="all">All history</option>
          </select>
          {unit !== "all" && (
            <select
              aria-label="Insights period"
              value={anchor}
              disabled={generating}
              onChange={(e) => setChoice({ context, anchor: e.target.value })}
            >
              {!periods.some((p) => p.start === anchor) && (
                <option value={anchor}>{facts.period.label}</option>
              )}
              {periods.map((p) => (
                <option key={p.key} value={p.start}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
        </div>
        <Button
          disabled={generating || loading || !facts.count}
          onClick={settings.aiConfigured ? generate : onSettings}
        >
          {generating ? (
            <AiOrb state="composing" />
          ) : report ? (
            <RefreshCw size={14} />
          ) : (
            <Sparkles size={14} />
          )}{" "}
          {generating
            ? "Generating…"
            : !settings.aiConfigured
              ? "Connect AI"
              : report
                ? "Regenerate"
                : "Generate insights"}
        </Button>
      </div>
      {error && (
        <div role="alert" className="form-error insights-error">
          {error}
        </div>
      )}
      {generating && (
        <div className="report-generating" role="status">
          <AiOrb size={64} state="composing" />
          <span>Reviewing your spending and preparing the report…</span>
        </div>
      )}
      {report ? (
        <article className="insight-report">
          {saved.stale && (
            <div className="stale-report">
              <TriangleAlert size={15} />
              <span>
                Transactions or reporting dates changed. This report shows an
                earlier snapshot.
              </span>
              <button disabled={generating} onClick={generate}>
                Regenerate <RefreshCw size={12} />
              </button>
            </div>
          )}
          <header className="report-intro">
            <div className="report-meta">
              <span>
                <Sparkles size={12} />
                Spending insights
              </span>
              <span>{report.facts.period.label}</span>
              <span>
                <Clock3 size={11} />
                {new Date(report.generatedAt).toLocaleString("en-CA", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <h2>{report.title}</h2>
            <p>{report.summary}</p>
            {(report.facts.coverage.missingStart ||
              report.facts.coverage.missingEnd) && (
              <div className="report-coverage">
                Partial history:{" "}
                {report.facts.coverage.from &&
                  dateLabel(report.facts.coverage.from)}{" "}
                –{" "}
                {report.facts.coverage.to &&
                  dateLabel(report.facts.coverage.to)}
                . Only imported transactions are included.
              </div>
            )}
            <div className="report-metrics">
              <div>
                <span>Net spend</span>
                <AnimatedAmount cents={report.facts.netCents} />
              </div>
              <div>
                <span>Transactions</span>
                <strong>{report.facts.count}</strong>
              </div>
              <div>
                <span>Refunds</span>
                <AnimatedAmount cents={report.facts.refundCents} />
              </div>
            </div>
          </header>
          <div className="report-sections">
            {report.sections.map((section, index) => (
              <section className="report-section panel" key={index}>
                <div className="report-section-text">
                  <span className="section-number">0{index + 1}</span>
                  <h3>{section.heading}</h3>
                  <p>{section.body}</p>
                </div>
                <div className="report-visual">
                  <ReportVisual type={section.visual} facts={report.facts} />
                </div>
              </section>
            ))}
          </div>
          <ReportData facts={report.facts} />
          <footer className="report-footer">
            AI interpretation · Charts calculated from imported transactions ·{" "}
            {report.model}
          </footer>
        </article>
      ) : loading ? (
        <div className="insights-empty panel" role="status">
          <DotLoader />
          <p>Loading reports…</p>
        </div>
      ) : (
        <div className="insights-empty panel">
          <span className="chat-orb">
            <Sparkles size={26} />
          </span>
          <h2>Your spending, explained.</h2>
          <p>
            {facts.count
              ? `${facts.count} transactions · ${facts.period.label}`
              : "No spending transactions in this period."}
          </p>
          <div className="insight-preview-stats">
            <div>
              <span>Net spend</span>
              <strong>{money(facts.netCents)}</strong>
            </div>
            <div>
              <span>Categories</span>
              <strong>{facts.categories.filter((c) => c.count).length}</strong>
            </div>
          </div>
          <Button
            disabled={generating || !facts.count}
            onClick={settings.aiConfigured ? generate : onSettings}
          >
            {generating ? <AiOrb state="composing" /> : <Sparkles size={15} />}{" "}
            {settings.aiConfigured ? "Generate insights" : "Connect OpenRouter"}
            <ArrowUpRight size={14} />
          </Button>
          <small>
            Interpretation, trends, and charts for the selected period.
          </small>
        </div>
      )}
    </div>
  );
}
