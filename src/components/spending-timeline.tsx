import { useState } from "react";
import type { ReactNode } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { TrendingUp, ChartNoAxesColumnIncreasing } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { categories, colors, dateLabel, money } from "@/lib/data";
import type { Category, Transaction } from "@/lib/data";
import {
  cumulativeSpending,
  listPeriods,
  makePeriod,
  observedCoverage,
} from "../../shared/analytics.ts";
import type { CumulativeData } from "../../shared/analytics.ts";
import { AnimatedAmount } from "./dashboard-details";

export function preferredAnchor(
  rows: Transaction[],
  unit: "month" | "week",
  month: string,
) {
  const dates = rows
    .filter((r) => month === "all" || r.date.startsWith(month))
    .map((r) => r.date)
    .sort();
  const latest =
    dates.at(-1) ||
    observedCoverage(rows)?.to ||
    new Date().toISOString().slice(0, 10);
  return makePeriod(
    unit,
    month !== "all" && !dates.length ? month + "-01" : latest,
  ).start;
}
export function CumulativePlot({
  data,
  showPrevious = true,
  compact = false,
}: {
  data: CumulativeData;
  showPrevious?: boolean;
  compact?: boolean;
}) {
  const currentColor =
    data.category === "all"
      ? "#a3e635"
      : colors[data.category as Category] || "#a3e635";
  const lastDay = data.current.points
    .filter((p) => p.cents !== null)
    .at(-1)?.day;
  const domainEnd = showPrevious
    ? Math.max(data.current.period.days, data.previous.period.days)
    : data.current.period.days;
  const tickDays =
    data.unit === "week"
      ? [1, 2, 3, 4, 5, 6, 7]
      : Array.from(new Set([1, 7, 14, 21, domainEnd]));
  const chart = data.points.filter((p) => p.day <= domainEnd);
  return (
    <div
      className={"cumulative-plot " + (compact ? "compact" : "")}
      role="img"
      aria-label={`${data.current.period.label} cumulative ${data.category === "all" ? "spending" : data.category} in CAD, by ${data.unit === "week" ? "weekday" : "day of month"}. ${showPrevious ? "Previous period overlaid." : ""}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chart}
          margin={{ top: 18, right: 12, bottom: 8, left: 0 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="#28282d"
            strokeDasharray="2 6"
          />
          <XAxis
            type="number"
            dataKey="day"
            domain={[0, domainEnd]}
            ticks={tickDays}
            tickFormatter={(d) =>
              data.unit === "week"
                ? ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d]
                : String(d)
            }
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#777783", fontSize: 10 }}
            dy={8}
          />
          <YAxis
            domain={[(dataMin) => Math.min(0, dataMin), "auto"]}
            tickFormatter={(c) =>
              Math.abs(c) >= 100000
                ? `$${(c / 100000).toFixed(1)}k`
                : `$${Math.round(c / 100)}`
            }
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#777783", fontSize: 10 }}
            width={54}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const point = chart.find((p) => p.day === Number(label));
              if (!point) return null;
              return (
                <div className="cumulative-tooltip">
                  <strong>
                    {Number(label) === 0 ? "Period start" : `Day ${label}`}
                  </strong>
                  {point.currentCents !== null && (
                    <div>
                      <i style={{ background: currentColor }} />
                      <span>
                        {point.currentDate
                          ? dateLabel(point.currentDate)
                          : "Selected"}
                      </span>
                      <b>{money(point.currentCents)}</b>
                    </div>
                  )}
                  {showPrevious && point.previousCents !== null && (
                    <div>
                      <i style={{ background: "#85858e" }} />
                      <span>
                        {point.previousDate
                          ? dateLabel(point.previousDate)
                          : "Previous"}
                      </span>
                      <b>{money(point.previousCents)}</b>
                    </div>
                  )}
                </div>
              );
            }}
          />
          <Area
            type="linear"
            dataKey="currentCents"
            stroke="none"
            fill={currentColor}
            fillOpacity={0.025}
            connectNulls={false}
            isAnimationActive={false}
          />
          {showPrevious && (
            <Line
              type="linear"
              dataKey="previousCents"
              name="Previous period"
              stroke="#777780"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 4, stroke: "#18181b", strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
          <Line
            type="linear"
            dataKey="currentCents"
            name="Selected period"
            stroke={currentColor}
            strokeWidth={2.7}
            dot={(props) => {
              const { cx, cy, payload } = props;
              return (
                <circle
                  key={payload.day}
                  cx={cx}
                  cy={cy}
                  r={payload.day === lastDay ? 4 : 0}
                  fill={currentColor}
                  stroke={payload.day === lastDay ? "#111113" : "none"}
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{ r: 5, stroke: "#18181b", strokeWidth: 2 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
export function SpendingTimeline({
  rows,
  month,
  activity,
}: {
  rows: Transaction[];
  month: string;
  activity: ReactNode;
}) {
  const [mode, setMode] = useState("cumulative"),
    [unit, setUnit] = useState<"week" | "month">("month"),
    [category, setCategory] = useState("all"),
    [showPrevious, setShowPrevious] = useState(true);
  const [choice, setChoice] = useState({ context: "", anchor: "" });
  const context = month + unit;
  const anchor =
    choice.context === context
      ? choice.anchor
      : preferredAnchor(rows, unit, month);
  const periods = listPeriods(rows, unit);
  const data = cumulativeSpending(rows, unit, anchor, category);
  const { current, previous, comparison } = data;
  return (
    <section className="panel timeline-panel">
      <div className="timeline-mode-row">
        <h2>Spending</h2>
        <Tabs value={mode} onValueChange={(v) => setMode(String(v))}>
          <TabsList className="period-tabs">
            <TabsTrigger value="activity">
              <ChartNoAxesColumnIncreasing size={12} />
              Activity
            </TabsTrigger>
            <TabsTrigger value="cumulative">
              <TrendingUp size={12} />
              Cumulative
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {mode === "activity" ? (
        activity
      ) : (
        <>
          <div className="cumulative-controls">
            <Tabs
              value={unit}
              onValueChange={(v) => setUnit(v as "week" | "month")}
            >
              <TabsList className="period-tabs">
                <TabsTrigger value="week">Weekly</TabsTrigger>
                <TabsTrigger value="month">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>
            <select
              aria-label="Cumulative period"
              value={anchor}
              onChange={(e) => setChoice({ context, anchor: e.target.value })}
            >
              {!periods.some((p) => p.start === anchor) && (
                <option value={anchor}>{current.period.label}</option>
              )}
              {periods.map((p) => (
                <option key={p.key} value={p.start}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="chart-filter">
            <div
              className="category-toggles"
              role="group"
              aria-label="Cumulative category"
            >
              {["all", ...categories].map((c) => (
                <button
                  key={c}
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                  className={category === c ? "selected" : ""}
                >
                  {c !== "all" && (
                    <i style={{ background: colors[c as Category] }} />
                  )}
                  {c === "all" ? "All" : c}
                </button>
              ))}
            </div>
          </div>
          <div className="cumulative-stat">
            <AnimatedAmount cents={current.totalCents} />
            <span>
              {current.coverage.to
                ? `Through ${dateLabel(current.coverage.to)}`
                : "No imported activity"}
            </span>
          </div>
          <CumulativePlot data={data} showPrevious={showPrevious} />
          <div className="cumulative-legend">
            <span>
              <i
                style={{
                  background:
                    category === "all"
                      ? "#a3e635"
                      : colors[category as Category],
                }}
              />
              {current.period.label}
            </span>
            <label>
              <input
                type="checkbox"
                checked={showPrevious}
                onChange={(e) => setShowPrevious(e.target.checked)}
              />
              <i className="previous-line" />
              Previous {unit}
              {(previous.coverage.missingStart ||
                previous.coverage.missingEnd) && <small>partial</small>}
            </label>
          </div>
          <div className="cumulative-note">
            {comparison.available
              ? `${money(Math.abs(comparison.deltaCents!))} ${comparison.deltaCents! >= 0 ? "more" : "less"} vs first ${comparison.days} days of previous ${unit}.`
              : "Not enough matching history for a period comparison."}
            {showPrevious &&
              previous.coverage.missingStart &&
              previous.coverage.from && (
                <span>
                  Previous period begins at {dateLabel(previous.coverage.from)};
                  earlier days weren’t imported.
                </span>
              )}
            {current.coverage.missingStart && current.coverage.from && (
              <span>
                Selected period starts at {dateLabel(current.coverage.from)};
                earlier days weren’t imported.
              </span>
            )}
            {showPrevious && !previous.coverage.hasData && (
              <span>No previous-period history imported.</span>
            )}
          </div>
          <details className="chart-data">
            <summary>
              View data <span>Daily cumulative · CAD</span>
            </summary>
            <div className="chart-data-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Selected period</th>
                    {showPrevious && <th>Previous period</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.points
                    .filter((p) => p.day > 0)
                    .map((p) => (
                      <tr key={p.day}>
                        <td>{p.day}</td>
                        <td>
                          {p.currentCents === null
                            ? "—"
                            : money(p.currentCents)}
                        </td>
                        {showPrevious && (
                          <td>
                            {p.previousCents === null
                              ? "—"
                              : money(p.previousCents)}
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
