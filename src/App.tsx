import modelSnapshot from "../shared/openai-models.json";
import { AiOrb } from "@/components/ai-orb";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Flag,
  LayoutGrid,
  Lightbulb,
  Layers2,
  Command as CommandIcon,
  Info,
  ListFilter,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Plus,
  Search,
  Settings2,
  ShoppingBag,
  ShoppingBasket,
  Sparkles,
  Upload,
  Utensils,
  Wallet,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster, toast } from "sonner";
import {
  api,
  categories,
  colors,
  dateLabel,
  merchantLabel,
  money,
  monthLabel,
  weekStart,
} from "@/lib/data";
import type { Category, Data, Settings, Transaction } from "@/lib/data";
import {
  AnimatedAmount,
  SpendSparkline,
  VisaCard,
  CategoryRing,
  QuickPrompt,
} from "@/components/dashboard-details";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Tooltip as Hint,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { SpendingTimeline } from "@/components/spending-timeline";
import { Insights } from "@/components/insights";
import "./App.css";
const icons = {
  Groceries: ShoppingBasket,
  "Eating out": Utensils,
  Shopping: ShoppingBag,
  Bills: Wallet,
  Other: ListFilter,
};
type Page = "Overview" | "Transactions" | "Ask Together" | "Insights";
function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <Layers2 size={21} strokeWidth={1.8} />
      </span>
      together
    </div>
  );
}
function App() {
  const [auth, setAuth] = useState<boolean | null>(null),
    [data, setData] = useState<Data | null>(null),
    [loadError, setLoadError] = useState("");
  const [page, setPage] = useState<Page>("Overview"),
    [month, setMonth] = useState(""),
    [category, setCategory] = useState("all"),
    [largeOnly, setLargeOnly] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false),
    [importOpen, setImportOpen] = useState(false),
    [editing, setEditing] = useState<Transaction | null>(null);
  const [aiBusy, setAiBusy] = useState(false),
    [chatPrompt, setChatPrompt] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const reduced = useReducedMotion();
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  const refresh = useCallback(async () => {
    try {
      const d = await api<Data>("/data");
      setData(d);
      setLoadError("");
      setMonth((m) => m || d.transactions[0]?.date.slice(0, 7) || "all");
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    api<{ authenticated: boolean }>("/session")
      .then((d) => setAuth(d.authenticated))
      .catch(() => setAuth(false));
    const out = () => {
      setAuth(false);
      setData(null);
    };
    window.addEventListener("signed-out", out);
    return () => window.removeEventListener("signed-out", out);
  }, []);
  useEffect(() => {
    if (!auth) return;
    void refresh();
    const t = setInterval(() => {
      void refresh();
    }, 15000);
    const focus = () => {
      void refresh();
    };
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", focus);
    };
  }, [auth, refresh]);
  if (auth === null)
    return (
      <div className="loading">
        <Brand />
        <LoaderCircle className="spin" />
      </div>
    );
  if (!auth)
    return (
      <>
        <Login onLogin={() => setAuth(true)} />
        <Toaster richColors />
      </>
    );
  if (!data)
    return (
      <div className="loading">
        <Brand />
        {loadError ? (
          <>
            <p>{loadError}</p>
            <Button onClick={refresh}>Try again</Button>
          </>
        ) : (
          <LoaderCircle className="spin" />
        )}
      </div>
    );
  const months = Array.from(
    new Set(data.transactions.map((t) => t.date.slice(0, 7))),
  )
    .sort()
    .reverse();
  const period = data.transactions.filter(
    (t) => month === "all" || t.date.startsWith(month),
  );
  const expenses = period.filter((t) => t.kind !== "payment"),
    total = expenses.reduce((s, t) => s + t.cents, 0);
  const large = expenses.filter((t) => t.cents > data.settings.threshold * 100);
  const review = expenses.filter((t) => t.source === "review");
  const dates = data.transactions.map((t) => t.date).sort();
  const showTransactions = (cat = "all", flag = false) => {
    setCategory(cat);
    setLargeOnly(flag);
    setPage("Transactions");
  };
  const ask = (prompt: string) => {
    setChatPrompt(prompt);
    setPage("Ask Together");
  };
  async function categorize() {
    setAiBusy(true);
    try {
      const r = await api<{ updated: number }>("/categorize", "POST", {});
      toast.success(
        r.updated
          ? `${r.updated} transactions categorized`
          : "No additional categories found. Remaining items need your review.",
      );
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <button
          className="command-trigger"
          onClick={() => setCommandOpen(true)}
        >
          <Search size={15} />
          <span>Jump to…</span>
          <kbd>⌘ K</kbd>
        </button>
        <nav aria-label="Main navigation">
          {(
            [
              { name: "Overview", icon: LayoutGrid },
              { name: "Transactions", icon: ListFilter },
              { name: "Insights", icon: Lightbulb },
              { name: "Ask Together", icon: Sparkles },
            ] as const
          ).map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={page === name ? "nav-item active" : "nav-item"}
              onClick={() => setPage(name)}
            >
              {page === name && (
                <motion.span
                  className="nav-active-bg"
                  layoutId="active-navigation"
                  transition={{
                    type: "spring",
                    duration: reduced ? 0 : 0.22,
                    bounce: 0,
                  }}
                />
              )}
              <Icon size={18} />
              <span>{name === "Ask Together" ? "Assistant" : name}</span>
              {name === "Ask Together" && <span className="ai-label">AI</span>}
            </button>
          ))}
        </nav>
        <div className="account-label">
          ACCOUNT <span>01</span>
        </div>
        <VisaCard name={data.settings.cardName} lastFour={data.settings.cardLastFour} />
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setSettingsOpen(true)}>
            <Settings2 size={18} />
            Settings
          </button>
          <div className="people">
            <div className="avatars">
              <span>H</span>
              <span>H</span>
            </div>
            <div>
              <strong>{data.settings.householdName}</strong>
              <small>Personal workspace</small>
            </div>
            <button
              aria-label="Sign out"
              className="icon-button"
              onClick={async () => {
                try {
                  await api("/logout", "POST", {});
                  setAuth(false);
                  setData(null);
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="workspace-symbol">
              <Layers2 size={14} />
            </span>{" "}
            Personal <span>/</span>{" "}
            <strong>{page === "Ask Together" ? "Assistant" : page}</strong>
          </div>
          <div className="topbar-right">
            <span className="local-status">
              <span className="green-dot" /> Local
            </span>
            <button
              className="mobile-settings icon-button"
              aria-label="Settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 size={18} />
            </button>
            <Button
              className="import-button"
              onClick={() => setImportOpen(true)}
            >
              <Plus size={16} />
              Import CSV
            </Button>
          </div>
        </header>
        <div className="workspace">
          <div className="page-heading">
            <div>
              <h1>
                {page === "Overview"
                  ? "Overview"
                  : page === "Transactions"
                    ? "Transactions"
                    : page === "Insights"
                      ? "Insights"
                      : "Assistant"}
              </h1>
            </div>
            {page !== "Insights" && (
              <label className="period-select">
                <span className="sr-only">Reporting period</span>
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                >
                  <option value="all">All history</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {monthLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {loadError && (
            <div className="notice error" role="alert">
              Couldn’t refresh: {loadError}{" "}
              <button onClick={refresh}>Retry</button>
            </div>
          )}
          {data.transactions.length > 0 ? (
            <div className="coverage">
              <span className="green-dot" /> {dateLabel(dates[0])} –{" "}
              {dateLabel(dates.at(-1)!, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              <span className="coverage-divider">·</span>
              <span className="coverage-badge">Partial history</span>
              <TooltipProvider>
                <Hint>
                  <TooltipTrigger
                    className="coverage-info"
                    aria-label="About your spending totals"
                  >
                    <Info size={13} />
                  </TooltipTrigger>
                  <TooltipContent>
                    CAD · card payments excluded · refunds deducted. Only
                    imported dates are included.
                  </TooltipContent>
                </Hint>
              </TooltipProvider>
            </div>
          ) : null}
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, y: reduced ? 0 : 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.16 }}
            >
              {!data.transactions.length ? (
                <div className="empty-state panel">
                  <span className="empty-icon">
                    <Upload />
                  </span>
                  <h2>Import your transactions</h2>
                  <p>Choose a CSV from your Scotia Visa.</p>
                  <Button onClick={() => setImportOpen(true)}>
                    Import your first CSV <ArrowRight size={16} />
                  </Button>
                </div>
              ) : page === "Overview" ? (
                <>
                  <div className="stats-grid">
                    <button
                      className="stat-card featured"
                      onClick={() => showTransactions()}
                    >
                      <div className="stat-label">
                        Net spending <ArrowUpRight size={18} />
                      </div>
                      <div className="stat-number">
                        <AnimatedAmount cents={total} />
                      </div>
                      <SpendSparkline rows={expenses} />
                      <div className="stat-foot">
                        <span className="tiny-pill">CAD</span>
                        <span>{expenses.length} transactions</span>
                      </div>
                    </button>
                    <button
                      className="stat-card"
                      onClick={() => showTransactions("Groceries")}
                    >
                      <div className="stat-label">
                        <span>
                          <ShoppingBasket size={17} />
                          Groceries
                        </span>
                        <ArrowUpRight size={18} />
                      </div>
                      <div className="stat-number">
                        <AnimatedAmount
                          cents={expenses
                            .filter((t) => t.category === "Groceries")
                            .reduce((s, t) => s + t.cents, 0)}
                        />
                      </div>
                      <SpendSparkline rows={expenses} category="Groceries" />
                      <div className="stat-foot">
                        {
                          expenses.filter((t) => t.category === "Groceries")
                            .length
                        }{" "}
                        transactions
                      </div>
                    </button>
                    <button
                      className="stat-card"
                      onClick={() => showTransactions("all", true)}
                    >
                      <div className="stat-label">
                        <span>
                          <Flag size={17} />
                          Large purchases
                        </span>
                        <ArrowUpRight size={18} />
                      </div>
                      <div className="stat-number">
                        <AnimatedAmount
                          cents={large.reduce((s, t) => s + t.cents, 0)}
                        />
                        <span className="count-pill">{large.length}</span>
                      </div>
                      <div className="stat-foot">
                        Over {money(data.settings.threshold * 100)}
                      </div>
                    </button>
                  </div>
                  <div className="charts-grid">
                    <SpendingTimeline
                      rows={data.transactions}
                      month={month}
                      activity={<TrendChart rows={data.transactions} />}
                    />
                    <CategoryRing rows={expenses} onSelect={showTransactions} />
                  </div>
                  <QuickPrompt onAsk={ask} />
                  <section className="panel recent-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Recent activity</h2>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => showTransactions()}
                      >
                        View all <ArrowRight size={15} />
                      </Button>
                    </div>
                    <TransactionsTable
                      rows={period.slice(0, 5)}
                      threshold={data.settings.threshold}
                      onEdit={setEditing}
                    />
                  </section>
                  {review.length > 0 && (
                    <div className="review-note">
                      <span>{review.length} uncategorized</span>
                      <button onClick={() => showTransactions("Other")}>
                        Review <ArrowRight size={14} />
                      </button>
                      {data.settings.aiConfigured && (
                        <button disabled={aiBusy} onClick={categorize}>
                          {aiBusy ? <AiOrb /> : <Sparkles size={14} />}
                          Categorize with AI
                        </button>
                      )}
                    </div>
                  )}
                </>
              ) : page === "Transactions" ? (
                <TransactionView
                  rows={period}
                  category={category}
                  setCategory={setCategory}
                  largeOnly={largeOnly}
                  setLargeOnly={setLargeOnly}
                  threshold={data.settings.threshold}
                  onEdit={setEditing}
                  aiConfigured={data.settings.aiConfigured}
                  aiBusy={aiBusy}
                  categorize={categorize}
                />
              ) : page === "Insights" ? (
                <Insights
                  rows={data.transactions}
                  month={month}
                  settings={data.settings}
                  onSettings={() => setSettingsOpen(true)}
                />
              ) : (
                <Chat
                  key={month}
                  month={month}
                  configured={data.settings.aiConfigured}
                  onSettings={() => setSettingsOpen(true)}
                  initialPrompt={chatPrompt}
                  onPromptUsed={() => setChatPrompt("")}
                  count={period.length}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="settings-dialog">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Shared across your devices.</DialogDescription>
          </DialogHeader>
          {settingsOpen && (
            <SettingsForm
              settings={data.settings}
              rules={data.rules}
              onSaved={refresh}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import transactions</DialogTitle>
            <DialogDescription>
              Upload the original CSV downloaded from your Scotia Visa
              transaction history.
            </DialogDescription>
          </DialogHeader>
          <ImportForm imports={data.imports} onImported={refresh} />
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit transaction</DialogTitle>
            <DialogDescription>
              Changes update your totals and trends for both of you.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <EditForm
              transaction={editing}
              onSaved={async () => {
                setEditing(null);
                await refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <CommandDialog
        open={commandOpen}
        onOpenChange={setCommandOpen}
        title="Jump to"
        description="Navigate your spending"
        className="command-dialog"
      >
        <Command>
          <CommandInput placeholder="Search pages or categories…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup heading="Navigate">
              {(
                [
                  "Overview",
                  "Transactions",
                  "Insights",
                  "Ask Together",
                ] as const
              ).map((name) => (
                <CommandItem
                  key={name}
                  value={name === "Ask Together" ? "Assistant AI chat" : name}
                  onSelect={() => {
                    setPage(name);
                    setCommandOpen(false);
                  }}
                >
                  {name === "Ask Together" ? <Sparkles /> : <LayoutGrid />}
                  {name === "Ask Together" ? "Assistant" : name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Categories">
              {categories.map((c) => (
                <CommandItem
                  key={c}
                  onSelect={() => {
                    showTransactions(c);
                    setCommandOpen(false);
                  }}
                >
                  <i
                    className="command-dot"
                    style={{ background: colors[c] }}
                  />
                  {c}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Actions">
              <CommandItem
                onSelect={() => {
                  setImportOpen(true);
                  setCommandOpen(false);
                }}
              >
                <Upload />
                Import CSV
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setSettingsOpen(true);
                  setCommandOpen(false);
                }}
              >
                <Settings2 />
                Settings
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="command-footer">
          <CommandIcon size={13} /> Navigate <kbd>↑ ↓</kbd>
          <span>
            Open <kbd>↵</kbd>
          </span>
        </div>
      </CommandDialog>
      <Toaster theme="dark" position="bottom-right" richColors />
    </div>
  );
}
function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/login", "POST", { password });
      onLogin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-brand">
        <Brand />
      </div>
      <div className="login-card">
        <div className="login-symbol">
          <Layers2 size={28} />
        </div>
        <h1>Welcome back.</h1>
        <form onSubmit={submit}>
          <label htmlFor="password">Shared password</label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="login-submit" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <>
                Unlock <ArrowRight size={17} />
              </>
            )}
          </Button>
        </form>
        <div className="login-private">
          <LockKeyhole size={13} /> Your shared workspace
        </div>
      </div>
    </div>
  );
}
function TrendChart({ rows }: { rows: Transaction[] }) {
  const [interval, setInterval] = useState("week"),
    [category, setCategory] = useState("all");
  const expenses = rows.filter((t) => t.kind !== "payment"),
    dates = expenses.map((t) => t.date).sort();
  const groups: Record<string, Record<string, string | number>> = {};
  if (dates.length) {
    const start = new Date(
        (interval === "week"
          ? weekStart(dates[0])
          : dates[0].slice(0, 7) + "-01") + "T12:00:00Z",
      ),
      end = new Date(dates.at(-1)! + "T12:00:00Z");
    for (
      let d = new Date(start);
      d <= end;
      interval === "week"
        ? d.setUTCDate(d.getUTCDate() + 7)
        : d.setUTCMonth(d.getUTCMonth() + 1)
    ) {
      const key = d.toISOString().slice(0, interval === "week" ? 10 : 7);
      groups[key] = {
        label:
          interval === "week"
            ? dateLabel(key)
            : dateLabel(key + "-01", { month: "short", year: "2-digit" }),
        ...Object.fromEntries(categories.map((c) => [c, 0])),
      };
    }
  }
  for (const t of expenses) {
    const key = interval === "week" ? weekStart(t.date) : t.date.slice(0, 7);
    if (groups[key])
      groups[key][t.category] =
        Number(groups[key][t.category] || 0) + t.cents / 100;
  }
  const chart = Object.values(groups).slice(interval === "week" ? -16 : -12);
  const active = category === "all" ? categories : [category as Category];
  return (
    <section className="panel trend-panel">
      <div className="panel-heading">
        <div>
          <h2>Spending activity</h2>
          <span className="history-chip">All history</span>
        </div>
        <Tabs value={interval} onValueChange={(v) => setInterval(String(v))}>
          <TabsList className="period-tabs">
            {["week", "month"].map((v) => (
              <TabsTrigger key={v} value={v}>
                {interval === v && (
                  <motion.span
                    className="tab-pill"
                    layoutId="chart-interval"
                    transition={{ type: "spring", duration: 0.22, bounce: 0 }}
                  />
                )}
                <span>{v === "week" ? "Weekly" : "Monthly"}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div className="chart-filter">
        <div
          className="category-toggles"
          role="group"
          aria-label="Trend category"
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
      <div
        className="chart"
        role="img"
        aria-label={`${interval === "week" ? "Weekly" : "Monthly"} net spending for ${category === "all" ? "all categories" : category}. Detailed amounts available below.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chart}
            barSize={interval === "week" ? 56 : 76}
            margin={{ top: 15, right: 8, bottom: 0, left: -15 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="#2a2a2e"
              strokeDasharray="2 5"
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#71717a", fontSize: 11 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#71717a", fontSize: 11 }}
              tickFormatter={(v) =>
                Math.abs(v) >= 1000 ? `$${v / 1000}k` : `$${v}`
              }
            />
            <Tooltip
              cursor={{ fill: "#ffffff06" }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #36363c",
                background: "#18181b",
                color: "#fafafa",
                fontSize: 12,
              }}
              formatter={(value) => money(Math.round(Number(value) * 100))}
            />
            {active.map((c) => (
              <Bar
                key={c}
                dataKey={c}
                stackId="spend"
                fill={colors[c]}
                radius={active.at(-1) === c ? [5, 5, 0, 0] : [0, 0, 0, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="chart-data">
        <summary>
          View data{" "}
          <span>
            {interval === "week" ? "Monday–Sunday" : "Calendar months"}
          </span>
        </summary>
        <div className="chart-data-scroll">
          <table>
            <thead>
              <tr>
                <th>Period</th>
                {active.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chart.map((r, i) => (
                <tr key={i}>
                  <td>{r.label}</td>
                  {active.map((c) => (
                    <td key={c}>{money(Math.round(Number(r[c]) * 100))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
function TransactionsTable({
  rows,
  threshold,
  onEdit,
}: {
  rows: Transaction[];
  threshold: number;
  onEdit: (t: Transaction) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Merchant</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Category</TableHead>
          <TableHead className="amount-cell">Amount</TableHead>
          <TableHead>
            <span className="sr-only">Edit</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((t) => {
          const Icon = t.kind === "payment" ? ArrowDownLeft : icons[t.category];
          return (
            <TableRow
              key={t.id}
              className="transaction-row"
              onClick={() => onEdit(t)}
            >
              <TableCell>
                <div className="merchant-cell">
                  <span
                    className="merchant-icon"
                    style={{
                      background: colors[t.category] + "18",
                      color: colors[t.category],
                    }}
                  >
                    <Icon size={17} />
                  </span>
                  <span>
                    <button
                      className="merchant-name"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(t);
                      }}
                    >
                      {merchantLabel(t.merchant)}
                    </button>
                    <small>
                      {t.kind === "payment"
                        ? "Card payment · excluded"
                        : t.kind === "refund"
                          ? "Refund"
                          : t.detail.replace(/\(Apple Pay\)/, "").trim()}
                      {t.note && " · " + t.note}
                    </small>
                  </span>
                </div>
              </TableCell>
              <TableCell className="date-cell">
                {dateLabel(t.date, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </TableCell>
              <TableCell>
                <span className="category-badge">
                  <i
                    style={{
                      background:
                        t.kind === "payment" ? "#a8aea0" : colors[t.category],
                    }}
                  />
                  {t.kind === "payment" ? "Payment" : t.category}
                </span>
                {t.source === "review" && t.kind !== "payment" && (
                  <span className="review-dot" title="Needs review">
                    •
                  </span>
                )}
                {t.source === "ai" && (
                  <Sparkles
                    size={12}
                    className="inline-icon"
                    aria-label="AI categorized"
                  />
                )}
              </TableCell>
              <TableCell
                className={"amount-cell " + (t.cents < 0 ? "refund" : "")}
              >
                {t.cents > threshold * 100 && t.kind !== "payment" && (
                  <Flag
                    size={12}
                    className="inline-icon flag"
                    aria-label="Large purchase"
                  />
                )}
                {money(t.cents)}
              </TableCell>
              <TableCell>
                <ChevronRight size={14} className="row-chevron" />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
function TransactionView({
  rows,
  category,
  setCategory,
  largeOnly,
  setLargeOnly,
  threshold,
  onEdit,
  aiConfigured,
  aiBusy,
  categorize,
}: {
  rows: Transaction[];
  category: string;
  setCategory: (c: string) => void;
  largeOnly: boolean;
  setLargeOnly: (b: boolean) => void;
  threshold: number;
  onEdit: (t: Transaction) => void;
  aiConfigured: boolean;
  aiBusy: boolean;
  categorize: () => void;
}) {
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    [sort, setSort] = useState("newest"),
    [review, setReview] = useState(false);
  const filtered = rows
    .filter(
      (t) =>
        (category === "all" ||
          (category === "payment"
            ? t.kind === "payment"
            : t.category === category && t.kind !== "payment")) &&
        (!largeOnly || (t.cents > threshold * 100 && t.kind !== "payment")) &&
        (!review || (t.source === "review" && t.kind !== "payment")) &&
        `${t.merchant} ${t.detail} ${t.note}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "amount"
        ? b.cents - a.cents
        : sort === "oldest"
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date),
    );
  const maxPage = Math.max(0, Math.ceil(filtered.length / 20) - 1),
    safePage = Math.min(page, maxPage);
  const reset = (fn: () => void) => {
    fn();
    setPage(0);
  };
  return (
    <section className="panel transactions-panel">
      <div className="transaction-controls">
        <div className="search-field">
          <Search size={16} />
          <Input
            aria-label="Search transactions"
            placeholder="Search merchants or notes…"
            value={query}
            onChange={(e) => reset(() => setQuery(e.target.value))}
          />
        </div>
        <select
          aria-label="Category filter"
          value={category}
          onChange={(e) => reset(() => setCategory(e.target.value))}
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
          <option value="payment">Payments</option>
        </select>
        <select
          aria-label="Sort transactions"
          value={sort}
          onChange={(e) => reset(() => setSort(e.target.value))}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="amount">Largest first</option>
        </select>
      </div>
      <div className="transaction-filters">
        <button
          className={"filter-chip " + (largeOnly ? "selected" : "")}
          onClick={() => reset(() => setLargeOnly(!largeOnly))}
        >
          <Flag size={13} />
          Over {money(threshold * 100)}
          {largeOnly && <X size={12} />}
        </button>
        <button
          className={"filter-chip " + (review ? "selected" : "")}
          onClick={() => reset(() => setReview(!review))}
        >
          Needs review {review && <X size={12} />}
        </button>
        <span>{filtered.length} transactions</span>
        {aiConfigured && (
          <Button variant="ghost" disabled={aiBusy} onClick={categorize}>
            {aiBusy ? <AiOrb /> : <Sparkles size={14} />}
            AI categorize
          </Button>
        )}
      </div>
      {filtered.length ? (
        <TransactionsTable
          rows={filtered.slice(safePage * 20, safePage * 20 + 20)}
          threshold={threshold}
          onEdit={onEdit}
        />
      ) : (
        <div className="table-empty">
          <Search size={24} />
          <h3>No matching transactions</h3>
          <p>Try another search, month, or category.</p>
        </div>
      )}
      <div className="table-pagination">
        <span>
          {filtered.length
            ? `${safePage * 20 + 1}–${Math.min((safePage + 1) * 20, filtered.length)} of ${filtered.length}`
            : "0 transactions"}
          <span className="pagination-total">
            {" "}
            · Net{" "}
            {money(
              filtered
                .filter((t) => t.kind !== "payment")
                .reduce((s, t) => s + t.cents, 0),
            )}
          </span>
        </span>
        <div>
          <Button
            aria-label="Previous page"
            variant="outline"
            size="icon"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            aria-label="Next page"
            variant="outline"
            size="icon"
            disabled={safePage >= maxPage}
            onClick={() => setPage(safePage + 1)}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </section>
  );
}
function EditForm({
  transaction: t,
  onSaved,
}: {
  transaction: Transaction;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
      ...t,
      amount: (t.cents / 100).toFixed(2),
      remember: false,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const field = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ learned: number }>(
        "/transactions/" + t.id,
        "PATCH",
        {
          version: t.version,
          merchant: form.merchant,
          date: form.date,
          cents: Math.round(Number(form.amount) * 100),
          category: form.category,
          kind: form.kind,
          note: form.note,
          remember: form.remember,
        },
      );
      toast.success(
        result.learned
          ? `Saved. Updated ${result.learned} matching transactions too.`
          : "Transaction updated",
      );
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="stack-form" onSubmit={submit}>
      <label>
        Merchant
        <Input
          value={form.merchant}
          maxLength={200}
          onChange={(e) => field("merchant", e.target.value)}
          required
        />
      </label>
      <div className="form-grid">
        <label>
          Date
          <Input
            type="date"
            value={form.date}
            onChange={(e) => field("date", e.target.value)}
            required
          />
        </label>
        <label>
          Amount (CAD)
          <Input
            type="number"
            step="0.01"
            value={form.amount}
            onChange={(e) => field("amount", e.target.value)}
            required
          />
        </label>
      </div>
      <div className="form-grid">
        <label>
          Category
          <select
            value={form.category}
            onChange={(e) => field("category", e.target.value)}
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Transaction type
          <select
            value={form.kind}
            onChange={(e) => {
              field("kind", e.target.value);
              field(
                "amount",
                (
                  Math.abs(Number(form.amount)) *
                  (e.target.value === "purchase" ? 1 : -1)
                ).toFixed(2),
              );
            }}
          >
            <option value="purchase">Purchase</option>
            <option value="refund">Refund</option>
            <option value="payment">Card payment</option>
          </select>
        </label>
      </div>
      <label>
        Note <span className="muted">(optional)</span>
        <Textarea
          value={form.note}
          maxLength={1000}
          onChange={(e) => field("note", e.target.value)}
          placeholder="What was this for?"
        />
      </label>
      {form.kind !== "payment" && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.remember}
            onChange={(e) => field("remember", e.target.checked)}
          />
          <span>
            Remember this category for “{t.merchant_key}”
            <small>
              Applies to future imports and existing matches, except items you
              already edited.
            </small>
          </span>
        </label>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? (
          <LoaderCircle className="spin" size={16} />
        ) : (
          <Check size={16} />
        )}
        Save changes
      </Button>
    </form>
  );
}
function SettingsForm({
  settings,
  rules,
  onSaved,
}: {
  settings: Settings;
  rules: Data["rules"];
  onSaved: () => Promise<void>;
}) {
  const [threshold, setThreshold] = useState(String(settings.threshold)),
    [model, setModel] = useState(settings.model),
    [reasoningEffort, setReasoningEffort] = useState(
      settings.reasoningEffort || "default",
    ),
    [models, setModels] = useState(modelSnapshot),
    [key, setKey] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<{ models: typeof modelSnapshot }>("/models")
      .then((r) => {
        if (active) setModels(r.models);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const selectedModel = models.find((m) => m.id === model);
  const availableEfforts = selectedModel?.efforts || [];
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/settings", "PATCH", {
        threshold: Number(threshold),
        model,
        reasoningEffort,
        apiKey: key,
      });
      setKey("");
      await onSaved();
      toast.success("Preferences saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="stack-form">
      <div className="settings-section">
        <h3>
          <Flag size={16} />
          Large purchases
        </h3>
        <p>
          Flag purchases above this amount. They keep their regular category.
        </p>
        <label>
          Threshold (CAD)
          <Input
            type="number"
            min="0"
            max="1000000"
            step="0.01"
            required
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
        </label>
      </div>
      <div className="settings-section">
        <h3>
          <Sparkles size={16} />
          Your AI connection{" "}
          <span className={settings.aiConfigured ? "connected" : "muted"}>
            {settings.aiConfigured ? "Connected" : "Not set up"}
          </span>
        </h3>
        <p>
          Chat and optional categorization use OpenRouter. Relevant transactions
          are sent to your selected model when you use these features.
        </p>
        <label>
          OpenRouter API key
          <Input
            type="password"
            autoComplete="new-password"
            placeholder={
              settings.aiConfigured
                ? "Key saved · leave blank to keep"
                : "sk-or-…"
            }
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
        <label>
          OpenAI model
          <select
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setReasoningEffort("default");
            }}
          >
            {!selectedModel && <option value={model}>{model} · current</option>}
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Reasoning effort
          <select
            value={reasoningEffort}
            disabled={!availableEfforts.length}
            onChange={(e) => setReasoningEffort(e.target.value)}
          >
            <option value="default">
              Model default
              {selectedModel?.defaultEffort
                ? ` (${selectedModel.defaultEffort})`
                : ""}
            </option>
            {availableEfforts.map((e) => (
              <option key={e} value={e}>
                {e === "none"
                  ? "Off"
                  : e === "xhigh"
                    ? "Extra high"
                    : e.charAt(0).toUpperCase() + e.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <p className="field-help">
          {availableEfforts.length
            ? "Higher effort can take longer and use more credits."
            : "This model uses its default reasoning behavior."}{" "}
          Applies to chat, insights, and categorization.
        </p>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? (
          <LoaderCircle className="spin" size={16} />
        ) : (
          <Check size={16} />
        )}
        Save preferences
      </Button>
      {rules.length > 0 && (
        <div className="settings-section">
          <h3>Remembered categories</h3>
          <p>
            Removing a rule stops it applying to future imports. Existing labels
            stay as they are.
          </p>
          <div className="rules-list">
            {rules.map((r) => (
              <div key={r.merchant_key}>
                <span>
                  {merchantLabel(r.merchant_key)}
                  <small>{r.category}</small>
                </span>
                <Button
                  type="button"
                  aria-label={"Forget rule for " + r.merchant_key}
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    try {
                      await api(
                        "/rules/" + encodeURIComponent(r.merchant_key),
                        "DELETE",
                      );
                      await onSaved();
                      toast.success("Rule removed");
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  <X size={14} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
function ImportForm({
  imports,
  onImported,
}: {
  imports: Data["imports"];
  onImported: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<{
      added: number;
      skipped: number;
      pending: number;
    } | null>(null),
    [error, setError] = useState(""),
    [drag, setDrag] = useState(false);
  const select = (f?: File) => {
    setResult(null);
    setError("");
    if (f && f.size > 5500000) {
      setError("Choose a CSV smaller than 5.5 MB.");
      return;
    }
    setFile(f || null);
  };
  async function upload() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<{ added: number; skipped: number; pending: number }>(
        "/import",
        "POST",
        { name: file.name, csv: await file.text() },
      );
      setResult(r);
      setFile(null);
      await onImported();
      toast.success(`${r.added} transactions imported`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack-form">
      <label
        className={"upload-zone " + (drag ? "dragging" : "")}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          select(e.dataTransfer.files[0]);
        }}
      >
        <Upload size={27} />
        <strong>{file ? file.name : "Drop your CSV here"}</strong>
        <span>
          {file
            ? "Ready to import"
            : "or click to choose a file · up to 5.5 MB"}
        </span>
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label="Choose Scotia CSV"
          onChange={(e) => select(e.target.files?.[0])}
        />
      </label>
      <p className="field-help">
        Posted transactions only. Overlapping exports are deduplicated. Payments
        are excluded from spending; refunds reduce it.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div className="import-result" role="status">
          <Check size={18} />
          <div>
            <strong>{result.added} transactions added</strong>
            <p>
              {result.skipped} already imported · {result.pending} unposted rows
              skipped
            </p>
          </div>
        </div>
      )}
      <Button disabled={!file || busy} onClick={upload}>
        {busy ? (
          <LoaderCircle size={16} className="spin" />
        ) : (
          <Upload size={16} />
        )}
        Import transactions
      </Button>
      {imports.length > 0 && (
        <div className="import-history">
          <h3>Recent imports</h3>
          {imports.slice(0, 3).map((i) => (
            <div key={i.id}>
              <span title={i.name}>{i.name}</span>
              <small>
                {i.added} added · {i.created.slice(0, 10)}
              </small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
type Message = { role: "user" | "assistant"; content: string };
function Chat({
  month,
  configured,
  onSettings,
  initialPrompt,
  onPromptUsed,
  count,
}: {
  month: string;
  configured: boolean;
  onSettings: () => void;
  initialPrompt: string;
  onPromptUsed: () => void;
  count: number;
}) {
  const [messages, setMessages] = useState<Message[]>([]),
    [input, setInput] = useState(initialPrompt),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (initialPrompt) onPromptUsed();
  }, [initialPrompt, onPromptUsed]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [messages, busy]);
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const next = [
      ...messages,
      { role: "user" as const, content: input.trim() },
    ];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const r = await api<{ answer: string }>("/chat", "POST", {
        messages: next.slice(-15),
        month,
      });
      setMessages([...next, { role: "assistant", content: r.answer }]);
    } catch (e) {
      setError((e as Error).message);
      setInput(next.at(-1)!.content);
      setMessages(messages);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="chat-panel panel">
      <div className="chat-header">
        <div>
          <span className="sparkle-tile">
            <Sparkles size={18} />
          </span>
          <strong>Ask Together</strong>
        </div>
        <span className="context-chip">
          <CreditCard size={13} />
          {monthLabel(month)} · {count} transactions
        </span>
      </div>
      <div className="chat-messages" aria-live="polite">
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <span className="chat-orb">
              <Sparkles size={30} strokeWidth={1.3} />
            </span>
            <h2>What would you like to know?</h2>
            <div className="prompt-grid">
              {[
                {
                  label: "Top merchants",
                  prompt: "Which merchants did we spend the most with?",
                  icon: ShoppingBag,
                },
                {
                  label: "Eating out",
                  prompt: "How much did we spend on eating out?",
                  icon: Utensils,
                },
                {
                  label: "Large purchases",
                  prompt: "Which purchases were over our threshold?",
                  icon: Flag,
                },
                {
                  label: "Grocery trends",
                  prompt: "Compare grocery spending week by week.",
                  icon: ShoppingBasket,
                },
              ].map(({ label, prompt, icon: Icon }) => (
                <button key={label} onClick={() => setInput(prompt)}>
                  <Icon size={17} />
                  {label}
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
            {!configured && (
              <div className="ai-setup">
                <LockKeyhole size={18} />
                <div>
                  <strong>Connect OpenRouter to start.</strong>
                </div>
                <Button variant="outline" onClick={onSettings}>
                  Connect AI
                </Button>
              </div>
            )}
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={"chat-message " + m.role}>
              {m.role === "assistant" && (
                <span className="answer-icon">
                  <Sparkles size={17} />
                </span>
              )}
              <div>
                <small>{m.role === "user" ? "You" : "Together"}</small>
                <div className="message-content">{m.content}</div>
              </div>
            </div>
          ))
        )}
        {busy && (
          <div className="thinking" role="status">
            <AiOrb size={64} /> Analyzing spending
          </div>
        )}
        {error && (
          <div className="form-error" role="alert">
            {error} Retry below.
          </div>
        )}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="chat-composer">
        <div className="composer-box">
          <Textarea
            aria-label="Ask a question about your spending"
            value={input}
            maxLength={6000}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your spending…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            aria-label="Send question"
            disabled={busy || !input.trim() || !configured}
          >
            {busy ? <AiOrb /> : <ArrowRight size={18} />}
          </Button>
        </div>
        <div className="composer-note">
          <span>
            <span className="green-dot" />
            Imported transactions
          </span>
          <span>Verify important amounts.</span>
        </div>
      </form>
    </section>
  );
}
export default App;
