# Together

A small shared expense dashboard for a Scotiabank Visa. Self-hosted on your computer, with a shared password, SQLite storage, CSV imports, and optional OpenRouter AI.

Your spending, on your own machine. Bring a CSV and your own AI key.

MIT licensed. Currently supports Scotiabank Visa CSV exports and CAD, one shared card, and one shared household password. Other bank formats and currencies need an importer change. This is an independent project, not affiliated with Scotiabank or OpenRouter.

## Use it

- **Overview:** net spending, groceries, configurable large-purchase flags, and category breakdowns for the selected month or all history.
- **Cumulative spending:** switch the Spending chart between Activity and Cumulative. Choose a calendar month or Monday-start week, filter one category, and optionally overlay the previous period aligned by day. Comparisons use matching elapsed days; missing imported history is marked and excluded from comparisons.
- **Insights:** choose a week, month, or all history and generate an AI report with interpretation and transaction-backed charts. Reports are saved per period and marked out of date when underlying data changes. Regeneration replaces the saved report only after success.
- **Activity trends:** choose any category, then switch between Monday-start weeks and calendar months. Trends use all imported history (up to the most recent 16 weeks / 12 months), independently of the summary's month filter. Expand “View data” for exact values.
- **Transactions:** search, filter, sort, and select a row to edit its merchant, date, amount, category, type, or note. “Remember” applies a category to future imports and existing matching merchants, preserving manual edits.
- **Assistant:** select a reporting period, then ask questions. Add an OpenRouter API key, choose an OpenAI model, and set reasoning effort in Settings. The dropdown uses OpenRouter’s current compatible text-model catalog with a bundled offline fallback. Effort choices follow each model’s supported levels; Model default preserves provider behavior. Higher effort can take longer and use more credits. Changing the period or leaving the chat clears its conversation; chats are not saved to disk.
- **Import CSV:** choose the original Scotia download. All accepted rows import atomically. Posted debits are purchases; credits are refunds, with common payment descriptions recognized separately. Review “Other” for ambiguous merchants and check credit types after importing.

Money is stored as integer CAD cents. Card payments never count as spending. Refunds subtract from the category they are assigned to. A large-purchase flag is strictly **above** the configured threshold and never replaces a category. Refunds remain in their posting period.

Imported date coverage is based on observed rows, not proof of complete statements. Partial periods are explicitly marked. No bank connection or scheduled download is implied.

The interface uses dark shadcn surfaces, interactive category-ring filtering, animated totals, sliding tabs, and a compact question bar. Press **⌘K** (Ctrl+K on Windows) to jump to a view, category, import, or Settings.

## Local setup

Requires Node.js 24+.

```sh
git clone https://github.com/A2ed/together-expenses.git
cd together-expenses
npm ci
npm run setup
# Open .env locally to read the generated password or set your own (12+ characters).
npm run build
npm start
```

Set optional `HOUSEHOLD_NAME`, `CARD_NAME`, and `CARD_LAST_FOUR` in `.env` to personalize the interface. Never enter a full card number. Restart the server after changing these labels.

Open `http://localhost:4310`. Other devices on the same trusted Wi-Fi can use `http://YOUR-MAC-IP:4310` or `http://YOUR-MAC-HOSTNAME.local:4310`. The server binds to all network interfaces. Keep the Mac awake and allow Node through the macOS firewall if needed. A DHCP reservation keeps the IP stable. This is a local HTTP service; use an HTTPS reverse proxy and secure cookies before exposing it outside your home network.

The initial password is stored as a salted scrypt hash in the database. `APP_PASSWORD` is only read when that hash does not yet exist. It can be removed from `.env` after first startup. Login sessions expire after 30 days and are invalidated on logout. Separate laptops see updates automatically within 15 seconds and on refocus. Version checks prevent one laptop silently overwriting another's edits.

For macOS automatic startup:

```sh
npm run service:install
```

The per-user LaunchAgent `com.a2ed.together-expenses` starts immediately, restarts on failure, and starts when that macOS user logs in. It does not run while the Mac is shut down or sleeping. Reinstall it after moving the checkout or replacing the Node installation. Logs are in `logs/`.

To stop the installed service:

```sh
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.a2ed.together-expenses.plist
```

After changing source, run `npm run build` and `npm run service:install` to restart. For development, stop the service first and run `npm run dev` (Vite on 5173, API on 4310).

## Data and AI

- `data/household.sqlite` contains transactions, imports, preferences, learned rules, saved insights reports, and hashed sessions. `.env`, real CSV files, databases, logs, screenshots, and local credentials are excluded from Git.
- `npm run backup` creates a consistent SQLite backup in `data/backups/`. Keep a copy off the Mac if you need protection against hardware failure. Backups contain your private data and any saved OpenRouter key.
- AI calls happen only when you send a chat question, generate an insights report, or click AI categorization. Import categorization starts with local merchant rules and works without an API key. AI categorization only updates unresolved “Other” entries and never overwrites manual labels.
- The OpenRouter key is stored server-side in the local database (or supplied by `.env`). It is never returned by the API or bundled into the client. File permissions restrict local database access to the macOS user. The database is not encrypted at rest.
- Insights sends computed period totals, category and merchant aggregates, daily spending, large purchases, and previous-period comparisons to OpenRouter. The model writes the narrative and selects chart types; plotted values come from the app calculations.
- Chat sends the selected period's category/week/month/merchant totals and up to 2,000 transaction rows to OpenRouter. Truncation and date scope are included for the model. AI responses can be imperfect; use the dashboard/table to verify amounts. Live provider operation requires your own valid key, credits, and supported model ID.

Deduplication uses the original date, merchant, sub-description, amount, and occurrence number. Re-importing an overlapping export preserves edits and repeated identical purchases. Scotia does not include a stable transaction ID: a changed bank description can appear as a new transaction, and a partial export containing only some otherwise identical transactions cannot be disambiguated perfectly. Prefer complete overlapping exports for the date range.

For a demo on a fresh installation, import `examples/sample-scotia.csv` through the UI. All rows are fictional. Do not mix the sample into your real household database. Unknown example merchants start in Other; relabel them in Transactions.

Optional CLI import:

```sh
npm run import -- /absolute/path/to/scotia.csv
```

## Validation

```sh
npm test
npm run lint
npm run build
```

Tests exercise actual HTTP authentication, separate sessions, shared edits, conflict handling, CSRF protection, import atomicity/deduplication, payment/refund math, merchant rules, thresholds, missing AI configuration, cumulative calendar alignment, partial coverage, and report persistence/staleness/provider-failure handling. They use isolated temporary databases, never household data.

## Interface references

- [shadcn/ui](https://ui.shadcn.com/): generated Base UI buttons, inputs, dialogs, tabs, and tables.
- [Beautiful UI](https://www.beautifului.dev/): adapted chat context chips, suggestion cards, composer, and records-table patterns. No paid assets copied.
- [Thinking Orbs](https://libraries.dev/orbs): animated AI thinking indicators for chat, insights, and categorization, with reduced-motion support.
- [Transitions.dev](https://transitions.dev/): restrained tab, panel-reveal, and modal-transition patterns, with reduced-motion support.

Stack: React, TypeScript, Vite, Express, Node SQLite, Recharts, Motion, and Lucide. Fonts are served locally.

## License and contributing

Original project code is [MIT licensed](LICENSE). Dependencies retain their own licenses; see [third-party notices](public/third-party-notices.txt), including the Geist font license and shadcn component attribution. The notices are included with production builds.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and [SECURITY.md](SECURITY.md) for private vulnerability reporting and deployment boundaries.
