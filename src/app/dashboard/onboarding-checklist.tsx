"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Circle, X, Sparkles } from "lucide-react";

interface Props {
  hasBlocks: boolean;
  hasCustomized: boolean;
  hasView: boolean;
  username: string;
}

export function OnboardingChecklist({ hasBlocks, hasCustomized, hasView, username }: Props) {
  const allDone = hasBlocks && hasCustomized && hasView;
  const [dismissed, setDismissed] = useState(false);

  if (allDone || dismissed) return null;

  const steps = [
    {
      done: hasBlocks,
      title: "Add your first block",
      description: "Links, headings, text, or dividers",
      cta: "Add content",
      href: "/dashboard/content",
    },
    {
      done: hasCustomized,
      title: "Pick a theme",
      description: "Choose a preset or build your own look",
      cta: "Customize",
      href: "/dashboard/theme",
    },
    {
      done: hasView,
      title: "Share your page",
      description: "Get your first view from the wild",
      cta: "Open page",
      href: `/${username}`,
      external: true,
    },
  ];

  const completed = steps.filter((s) => s.done).length;

  return (
    <Card className="border-purple-300 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/40">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            Get started ({completed}/{steps.length})
          </CardTitle>
          <CardDescription>Finish these to make the most of LinkFolio</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {steps.map((step) => (
            <li
              key={step.title}
              className="flex items-center gap-3 rounded-lg bg-background/60 backdrop-blur p-3"
            >
              {step.done ? (
                <Check className="h-5 w-5 text-green-600 shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm ${step.done ? "line-through text-muted-foreground" : ""}`}>
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              {!step.done && (
                <Button
                  size="sm"
                  variant="outline"
                  render={
                    <Link
                      href={step.href}
                      target={step.external ? "_blank" : undefined}
                    />
                  }
                >
                  {step.cta}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
