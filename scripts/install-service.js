import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import path from "node:path";
if (process.platform !== "darwin")
  throw new Error(
    "This startup helper is for macOS. Use npm start on other systems.",
  );
const root = path.resolve(import.meta.dirname, "..");
if (!existsSync(path.join(root, "dist/index.html")))
  throw new Error("Run npm run build first.");
const label = "com.a2ed.together-expenses",
  domain = `gui/${process.getuid()}`;
const dest = path.join(homedir(), "Library/LaunchAgents", label + ".plist");
mkdirSync(path.dirname(dest), { recursive: true });
mkdirSync(path.join(root, "logs"), { recursive: true, mode: 0o700 });
const xml = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
writeFileSync(
  dest,
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(path.join(root, "server/index.js"))}</string></array>
<key>WorkingDirectory</key><string>${xml(root)}</string>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>10</integer>
<key>StandardOutPath</key><string>${xml(path.join(root, "logs/server.log"))}</string>
<key>StandardErrorPath</key><string>${xml(path.join(root, "logs/server-error.log"))}</string>
</dict></plist>`,
  { mode: 0o600 },
);
try {
  execFileSync("launchctl", ["bootout", domain, dest], { stdio: "ignore" });
} catch {}
execFileSync("launchctl", ["bootstrap", domain, dest]);
console.log(
  "Together is installed as a login service. It starts now and after you log in to this Mac.",
);
