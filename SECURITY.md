# Security

Together is an early self-hosted project for a trusted local network. It has not had an independent security audit. It is not a hosted multi-tenant service.

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/A2ed/together-expenses/security/advisories/new). Do not open a public issue containing credentials, bank exports, account details, or an exploitable vulnerability.

## Deployment boundary

- Use a unique shared password. The setup command generates one; it is hashed on first startup. Changing `.env` after initialization does not reset the saved password.
- The default HTTP service listens on all interfaces. Keep it on a trusted LAN. Internet deployment requires HTTPS, `COOKIE_SECURE=true`, an appropriately configured reverse proxy, and a separate security review.
- Database files, backups, and `.env` contain private information. Backups can include a saved OpenRouter API key. They are not encrypted at rest.
- AI is optional. Chat, insights, and AI categorization send relevant spending data to OpenRouter and the chosen model provider only when invoked. Local merchant rules do not need AI.
- Keep dependencies updated. Do not attach real financial data or browser network traces to bug reports.
