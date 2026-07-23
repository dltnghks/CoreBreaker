import { execFileSync, spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/").at(-1) ?? "";
const basePath = repositoryName ? `/${repositoryName}` : "";
const env = { ...process.env, GITHUB_PAGES: "true", GITHUB_PAGES_STATIC_SHELL: "true" };
const vinextCommand = resolve(root, process.platform === "win32" ? "node_modules/.bin/vinext.cmd" : "node_modules/.bin/vinext");

execFileSync(vinextCommand, ["build"], { cwd: root, env, stdio: "inherit", shell: process.platform === "win32" });

const port = 4173;
const server = spawn(vinextCommand, ["start", "--port", String(port)], { cwd: root, env, stdio: "inherit", shell: process.platform === "win32" });
const origin = `http://127.0.0.1:${port}`;

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${origin}${basePath}/`);
      if (response.ok) return;
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error("vinext production server did not start in time");
}

try {
  await waitForServer();
  const routes = ["", "benchmark", "skill-lab", "stage-lab"];
  for (const route of routes) {
    const response = await fetch(`${origin}${basePath}/${route}`);
    if (!response.ok) throw new Error(`Failed to render ${route || "/"}: HTTP ${response.status}`);
    const outputDirectory = route ? join(root, "dist", "client", route) : join(root, "dist", "client");
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(join(outputDirectory, "index.html"), await response.text(), "utf8");
  }
  await writeFile(join(root, "dist", "client", "404.html"), await (await fetch(`${origin}${basePath}/`)).text(), "utf8");
  await writeFile(join(root, "dist", "client", ".nojekyll"), "", "utf8");
} finally {
  server.kill("SIGTERM");
}
