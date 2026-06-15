import { NextRequest, NextResponse } from "next/server";
import vm from "node:vm";
import { z } from "zod";
import { getProblem } from "@/content/problems";

const RunSchema = z.object({
  problemId: z.string().min(1),
  code: z.string().min(1).max(100_000),
});

/**
 * Minimal JS judge endpoint used for demo consistency.
 *
 * SECURITY NOTE:
 * This is NOT a hardened sandbox for untrusted internet traffic.
 * It uses node:vm with strict timeouts and no host globals, which is suitable
 * for local hackathon demos but not for multi-tenant production execution.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = RunSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const problem = getProblem(parsed.data.problemId);
  if (!problem || problem.subject !== "programming") {
    return NextResponse.json({ error: "programming problem not found" }, { status: 404 });
  }
  if (problem.language !== "javascript") {
    return NextResponse.json({ error: "only javascript problems are supported" }, { status: 400 });
  }

  const fnNameMatch = problem.starterCode.match(/function\s+(\w+)/);
  const fnName = fnNameMatch ? fnNameMatch[1] : "solution";

  const sandbox = Object.create(null) as Record<string, unknown>;
  const context = vm.createContext(sandbox);

  try {
    const setup = new vm.Script(`"use strict";\n${parsed.data.code}\nthis.__entry = ${fnName};`);
    setup.runInContext(context, { timeout: 200 });
    const fn = sandbox.__entry;
    if (typeof fn !== "function") {
      return NextResponse.json({ error: `function ${fnName} not found` }, { status: 400 });
    }

    const results = problem.testCases.map((tc) => {
      try {
        const argsScript = new vm.Script(`[${tc.input}]`);
        const args = argsScript.runInContext(context, { timeout: 100 }) as unknown[];
        const resultScript = new vm.Script(`this.__entry(...this.__args)`);
        sandbox.__args = args;
        const got = resultScript.runInContext(context, { timeout: 100 });
        delete sandbox.__args;
        const gotStr = JSON.stringify(got);
        return {
          input: tc.input,
          expected: tc.expected,
          got: gotStr,
          ok: gotStr === tc.expected,
        };
      } catch (err) {
        return {
          input: tc.input,
          expected: tc.expected,
          got: `error: ${(err as Error).message}`,
          ok: false,
        };
      }
    });

    const passed = results.filter((r) => r.ok).length;
    return NextResponse.json({ ok: true, passed, total: results.length, results });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "run failed" },
      { status: 400 }
    );
  }
}
