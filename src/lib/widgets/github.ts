import "server-only";
import type { GitHubRepoData, GitHubUserData } from "./types";

const BASE = "https://api.github.com";

function headers() {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return h;
}

async function gh<T>(path: string, revalidate: number): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, {
    headers: headers(),
    next: { revalidate, tags: ["github"] },
  });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

interface RawRepo {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  owner: { login: string; avatar_url: string };
  html_url: string;
}

interface RawUser {
  login: string;
  name: string | null;
  bio: string | null;
  avatar_url: string;
  followers: number;
  public_repos: number;
  html_url: string;
}

export async function getGitHubRepo(owner: string, repo: string): Promise<GitHubRepoData | null> {
  const data = await gh<RawRepo>(`/repos/${owner}/${repo}`, 60 * 10);
  if (!data) return null;
  return {
    full_name: data.full_name,
    description: data.description,
    stargazers_count: data.stargazers_count,
    forks_count: data.forks_count,
    language: data.language,
    owner: { login: data.owner.login, avatar_url: data.owner.avatar_url },
    html_url: data.html_url,
  };
}

export async function getGitHubUser(username: string): Promise<GitHubUserData | null> {
  const data = await gh<RawUser>(`/users/${username}`, 60 * 30);
  if (!data) return null;
  return {
    login: data.login,
    name: data.name,
    bio: data.bio,
    avatar_url: data.avatar_url,
    followers: data.followers,
    public_repos: data.public_repos,
    html_url: data.html_url,
  };
}

export interface ParsedGitHub {
  kind: "github_repo" | "github_user";
  owner?: string;
  repo?: string;
  username?: string;
}

export function parseGitHubUrl(input: string): ParsedGitHub | null {
  const m = input.trim().match(/(?:github\.com\/)?([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38}[a-zA-Z0-9])?)(?:\/([a-zA-Z0-9._-]{1,100}))?\/?$/i);
  if (!m) return null;
  const owner = m[1];
  const repo = m[2];
  if (!owner) return null;
  if (repo) return { kind: "github_repo", owner, repo };
  // Bare GitHub URL only — must have github.com prefix to qualify
  if (!/github\.com/i.test(input)) return null;
  return { kind: "github_user", username: owner };
}
