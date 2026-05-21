/**
 * Constants for the AI copy-assist feature. Lives outside the `"use server"`
 * actions file because that file is only allowed to export async functions.
 */

export type CopyIntent = "improve" | "shorter" | "longer" | "punchier" | "friendlier";

export const COPY_INTENTS: CopyIntent[] = ["improve", "shorter", "longer", "punchier", "friendlier"];

export const COPY_INTENT_DESCRIPTION: Record<CopyIntent, string> = {
  improve: "improve clarity, tighten phrasing, keep the original tone",
  shorter: "make the text dramatically shorter without losing the key idea",
  longer: "expand the text by ~50% with concrete detail or texture",
  punchier: "rewrite in a sharper, more confident voice — short sentences, no hedging",
  friendlier: "rewrite in a warmer, more conversational voice",
};

export const COPY_SYSTEM_PROMPT = `You rewrite short pieces of copy on a creator's landing page (LinkFolio).
Constraints:
- Return ONLY the rewritten text. No quotes, no commentary, no markdown.
- Match the input language.
- Preserve any personal pronouns, links, handles, @-mentions, and emoji that were already there.
- Headings should stay under 60 characters when the input was already a heading.
- Bios stay under 220 characters.
- Don't invent facts the original text doesn't already imply.`;
