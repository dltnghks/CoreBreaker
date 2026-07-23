import type { NextConfig } from "next";

const githubPages = process.env.GITHUB_PAGES === "true";
const githubPagesStaticShell = process.env.GITHUB_PAGES_STATIC_SHELL === "true";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/").at(-1) ?? "";
const userSiteRepository = repositoryName.endsWith(".github.io");
const basePath = githubPages && repositoryName && !userSiteRepository ? `/${repositoryName}` : "";

const nextConfig: NextConfig = {
  output: githubPages && !githubPagesStaticShell ? "export" : undefined,
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  images: { unoptimized: true },
};

export default nextConfig;
