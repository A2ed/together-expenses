import { useId, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { ArrowUpRight, CreditCard, Fingerprint, Sparkles } from "lucide-react";
import { categories, colors, money } from "@/lib/data";
import type { Category, Transaction } from "@/lib/data";

/** Transitions.dev number-pop pattern: animate only the value that changed. */
export function AnimatedAmount({ cents }: { cents: number }) {
  const reduced = useReducedMotion();
  return (
    <span className="animated-amount" aria-label={money(cents)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={cents}
          aria-hidden
          initial={{
            opacity: 0,
            transform: reduced ? "none" : "translateY(7px)",
            filter: reduced ? "none" : "blur(2px)",
          }}
          animate={{
            opacity: 1,
            transform: "translateY(0)",
            filter: "blur(0px)",
          }}
          exit={{
            opacity: 0,
            transform: reduced ? "none" : "translateY(-7px)",
          }}
          transition={{ duration: reduced ? 0 : 0.2, ease: [0.23, 1, 0.32, 1] }}
        >
          {money(cents)}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** A data sparkline, using actual daily net spending in the selected period. */
export function SpendSparkline({
  rows,
  category,
}: {
  rows: Transaction[];
  category?: Category;
}) {
  const id = useId().replaceAll(":", "");
  const sums: Record<string, number> = {};
  for (const t of rows)
    if (t.kind !== "payment" && (!category || t.category === category))
      sums[t.date] = (sums[t.date] || 0) + t.cents;
  const values = Object.keys(sums)
    .sort()
    .map((k) => sums[k]);
  if (values.length < 2) return null;
  const max = Math.max(...values, 1),
    min = Math.min(...values, 0),
    range = max - min || 1;
  const points = values
    .map(
      (v, i) =>
        `${(i / (values.length - 1)) * 140},${39 - ((v - min) / range) * 34}`,
    )
    .join(" ");
  return (
    <svg className="spend-sparkline" viewBox="0 0 140 46" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity=".14" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,46 ${points} 140,46`} fill={`url(#${id})`} />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Pointer tilt + glare, adapted from Transitions.dev's 3D tilt interaction. */
export function VisaCard({
  name,
  lastFour,
}: {
  name: string;
  lastFour: string;
}) {
  const reduced = useReducedMotion();
  const rotateX = useSpring(0, { stiffness: 260, damping: 28 }),
    rotateY = useSpring(0, { stiffness: 260, damping: 28 });
  return (
    <motion.div
      className="sidebar-card"
      style={{ rotateX, rotateY }}
      onPointerMove={(e) => {
        if (reduced || e.pointerType !== "mouse") return;
        const b = e.currentTarget.getBoundingClientRect();
        rotateX.set((-(e.clientY - b.top - b.height / 2) / b.height) * 8);
        rotateY.set(((e.clientX - b.left - b.width / 2) / b.width) * 10);
      }}
      onPointerLeave={() => {
        rotateX.set(0);
        rotateY.set(0);
      }}
    >
      <div className="card-top">
        <CreditCard size={18} />
        <span>VISA</span>
      </div>
      <p>{name}</p>
      <div className="card-number">
        •••• <span>{lastFour || "••••"}</span>
        <Fingerprint size={24} />
      </div>
      <div className="card-bottom">
        <span>Shared account</span>
        <span>CAD</span>
      </div>
    </motion.div>
  );
}

export function CategoryRing({
  rows,
  onSelect,
}: {
  rows: Transaction[];
  onSelect: (category: Category) => void;
}) {
  const [active, setActive] = useState<Category | null>(null);
  const amounts = categories.map((category) => ({
    category,
    cents: rows
      .filter((t) => t.category === category && t.kind !== "payment")
      .reduce((s, t) => s + t.cents, 0),
  }));
  const base = amounts.reduce((s, t) => s + Math.max(0, t.cents), 0),
    net = amounts.reduce((s, t) => s + t.cents, 0);
  const focused = amounts.find((t) => t.category === active);
  const radius = 64,
    circumference = 2 * Math.PI * radius;
  return (
    <section className="panel category-panel">
      <div className="panel-heading">
        <h2>Categories</h2>
        <span className="panel-badge">{categories.length}</span>
      </div>
      <div className="ring-wrap">
        <svg viewBox="0 0 170 170" className="category-ring" aria-hidden>
          <circle
            cx="85"
            cy="85"
            r={radius}
            fill="none"
            stroke="#242427"
            strokeWidth="17"
          />
          {amounts.map(({ category, cents }, index) => {
            const length = base
                ? (Math.max(0, cents) / base) * circumference
                : 0,
              start = base
                ? (amounts
                    .slice(0, index)
                    .reduce((sum, item) => sum + Math.max(0, item.cents), 0) /
                    base) *
                  circumference
                : 0;
            return length > 0 ? (
              <circle
                key={category}
                cx="85"
                cy="85"
                r={radius}
                fill="none"
                stroke={colors[category]}
                strokeWidth={active === category ? 21 : 17}
                strokeDasharray={`${Math.max(0, length - 5)} ${circumference}`}
                strokeDashoffset={-start}
                transform="rotate(-90 85 85)"
                className="ring-segment"
                style={{ opacity: active && active !== category ? 0.28 : 1 }}
                onMouseEnter={() => setActive(category)}
                onMouseLeave={() => setActive(null)}
                onClick={() => onSelect(category)}
              />
            ) : null;
          })}
        </svg>
        <div className="ring-center">
          <span>{active || "Net spend"}</span>
          <AnimatedAmount cents={focused?.cents ?? net} />
        </div>
      </div>
      <div className="category-list">
        {amounts.map(({ category, cents }) => (
          <button
            key={category}
            onMouseEnter={() => setActive(category)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(category)}
            onBlur={() => setActive(null)}
            onClick={() => onSelect(category)}
            className={active === category ? "category-active" : ""}
          >
            <i style={{ background: colors[category] }} />
            <span>{category}</span>
            <span className="category-percent">
              {base ? Math.round((Math.max(0, cents) / base) * 100) : 0}%
            </span>
            <strong>{money(cents)}</strong>
            <ArrowUpRight size={13} />
          </button>
        ))}
      </div>
    </section>
  );
}

/** Beautiful UI's compact prompt-bar and context-chip patterns. */
export function QuickPrompt({ onAsk }: { onAsk: (prompt: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="quick-prompt"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onAsk(value.trim());
      }}
    >
      <Sparkles size={17} />
      <input
        aria-label="Quick question about spending"
        placeholder="Ask about your spending…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <span className="prompt-context">
        <CreditCard size={12} />
        Shared card
      </span>
      <button
        type="submit"
        disabled={!value.trim()}
        aria-label="Open question in chat"
      >
        <ArrowUpRight size={17} />
      </button>
    </form>
  );
}

export function DotLoader() {
  return (
    <span className="dot-loader" aria-hidden>
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} style={{ animationDelay: `${i * 0.08}s` }} />
      ))}
    </span>
  );
}
