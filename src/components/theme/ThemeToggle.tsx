"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options: { value: "light" | "dark" | "system"; icon: React.ReactNode; label: string }[] = [
    { value: "light", icon: <Sun size={12} />, label: "Light" },
    { value: "system", icon: <Monitor size={12} />, label: "System" },
    { value: "dark", icon: <Moon size={12} />, label: "Dark" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center gap-0.5 border border-rule bg-surface p-0.5"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          role="radio"
          aria-checked={theme === opt.value}
          aria-label={opt.label}
          onClick={() => setTheme(opt.value)}
          className={cn(
            "flex h-5 w-5 items-center justify-center transition-colors",
            theme === opt.value
              ? "bg-ink text-vellum"
              : "text-chalk hover:text-ink"
          )}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}

