// Run after npm ci when updating dependencies. Includes build tooling notices too.
import {
  readFileSync,
  readdirSync,
  existsSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const groups = new Map();
const missing = [];
for (const [directory, metadata] of Object.entries(lock.packages)) {
  if (!directory || !existsSync(directory + "/package.json")) continue;
  const pkg = JSON.parse(readFileSync(directory + "/package.json", "utf8"));
  const files = readdirSync(directory).filter((n) =>
    /^(licen[sc]e|copying|notice)(\.|$|-)/i.test(n),
  );
  let text = files
    .map((n) => {
      try {
        return readFileSync(directory + "/" + n, "utf8");
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
  const upstream =
    pkg.name === "react-remove-scroll-bar"
      ? "react-remove-scroll-bar"
      : pkg.name === "victory-vendor"
        ? "victory"
        : null;
  if (upstream)
    text +=
      "\n" + readFileSync("licenses/upstream/" + upstream + ".txt", "utf8");
  if (pkg.name === "victory-vendor") {
    for (const vendor of readdirSync(directory + "/lib-vendor")) {
      const file = directory + "/lib-vendor/" + vendor + "/LICENSE";
      if (existsSync(file))
        text += "\n\n" + vendor + "\n" + readFileSync(file, "utf8");
    }
  }
  if (!text) {
    missing.push(pkg.name);
    text = `License: ${pkg.license || metadata.license}\nSource: https://www.npmjs.com/package/${pkg.name}/v/${pkg.version}\nThe upstream package does not include a separate top-level license text.`;
  }
  const key = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
  const entries = groups.get(key) || [];
  entries.push(
    `${pkg.name}@${pkg.version} (${pkg.license || metadata.license})`,
  );
  groups.set(key, entries);
}
mkdirSync("public", { recursive: true });
writeFileSync(
  "public/third-party-notices.txt",
  "Together — third-party notices\n\nOriginal project code is MIT licensed. The following dependencies retain their own licenses. shadcn/ui notices also apply to generated components in src/components/ui. Font notices apply to the bundled Geist font.\n\n" +
    [...groups.entries()]
      .map(
        ([license, packages]) => packages.sort().join("\n") + "\n\n" + license,
      )
      .join("\n\n" + "=".repeat(78) + "\n\n") +
    "\n",
);
console.log({
  licenseGroups: groups.size,
  packagesWithoutTopLevelLicense: missing,
});
