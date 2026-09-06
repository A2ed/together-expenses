# Contributing

Issues and pull requests are welcome. Describe the problem and expected behavior, using synthetic data only. Start an issue before a large change or a new bank importer.

Requires Node.js 24+. Run `npm ci`, `npm run setup`, then `npm run dev`. The API runs on 4310 and Vite on 5173. Stop any production instance using those ports first. Avoid pointing a development instance at your household database.

Before submitting:

```sh
npm test
npm run lint
npm run build
```

Include tests for changes to import signs, payment/refund classification, deduplication, calendar comparisons, or persistence. Check both desktop and mobile for interface changes. Keep money in integer cents and distinguish observed CSV coverage from complete statements.

Do not commit `.env`, real exports, databases, screenshots containing personal data, or credentials. `examples/sample-scotia.csv` is intentionally synthetic and is the only CSV exempted from the ignore rule.

Contributions are provided under the project's MIT license. Preserve third-party notices; dependencies and fonts retain their own licenses.
