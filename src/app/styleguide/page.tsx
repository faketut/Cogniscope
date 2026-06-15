import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input, Textarea } from "@/components/ui/Input";

export const metadata = {
  title: "Style guide — Cogniscope",
};

const swatches: { name: string; cssVar: string }[] = [
  { name: "bg", cssVar: "--bg" },
  { name: "surface", cssVar: "--surface" },
  { name: "surface-2", cssVar: "--surface-2" },
  { name: "border", cssVar: "--border" },
  { name: "text-1", cssVar: "--text-1" },
  { name: "text-2", cssVar: "--text-2" },
  { name: "text-3", cssVar: "--text-3" },
  { name: "accent", cssVar: "--accent" },
  { name: "accent-soft", cssVar: "--accent-soft" },
  { name: "success", cssVar: "--success" },
  { name: "warn", cssVar: "--warn" },
  { name: "danger", cssVar: "--danger" },
];

export default function StyleguidePage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-12">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-3">
          Internal · dev only
        </p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight">Style guide</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-2">
          Living spec sheet for design tokens & primitive components. Toggle
          theme in the header to verify dark-mode parity.
        </p>
      </header>

      <Section title="Color tokens">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {swatches.map((s) => (
            <div
              key={s.name}
              className="overflow-hidden rounded-md border border-border"
            >
              <div
                className="h-12 w-full"
                style={{ background: `var(${s.cssVar})` }}
              />
              <div className="px-3 py-2 text-xs">
                <div className="font-mono text-text-1">{s.name}</div>
                <div className="font-mono text-text-3">{s.cssVar}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <div className="space-y-3">
          <p className="font-serif text-3xl tracking-tight">
            Newsreader · 40 / problem statements
          </p>
          <p className="font-serif text-2xl">Newsreader · 28 / section titles</p>
          <p className="text-xl">Inter · 20</p>
          <p className="text-base">Inter · 16 — body</p>
          <p className="text-sm text-text-2">Inter · 14 — supporting</p>
          <p className="font-mono text-xs text-text-3">
            JetBrains Mono · 12 — metadata
          </p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>neutral</Badge>
          <Badge tone="accent">accent</Badge>
          <Badge tone="success">success</Badge>
          <Badge tone="warn">warn</Badge>
          <Badge tone="danger">danger</Badge>
        </div>
      </Section>

      <Section title="Inputs">
        <div className="grid max-w-md gap-3">
          <Input placeholder="Single-line input" />
          <Textarea placeholder="Multi-line input" />
        </div>
      </Section>

      <Section title="Card">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Card title</CardTitle>
            <CardDescription>
              Cards are the workhorse surface for content groups.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-text-2">
            Cards use elev-1 shadow + 1px border. Hover responses are reserved
            for interactive cards.
          </CardContent>
        </Card>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-text-3">
        {title}
        <span className="h-px flex-1 bg-border" />
      </h2>
      {children}
    </section>
  );
}
