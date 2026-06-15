export type Subject = "math" | "programming";

export type Difficulty = "easy" | "medium" | "hard";

export interface MathStep {
  id: string;
  prompt: string; // plain text question for this step
  expectedAnswer: string; // canonical answer (for normalized compare)
  hint?: string;
}

export interface MathProblem {
  id: string;
  subject: "math";
  title: string;
  topic: string;
  difficulty: Difficulty;
  estMinutes: number;
  statement: string; // markdown + LaTeX
  steps: MathStep[];
  finalAnswer: string;
}

export interface ProgrammingProblem {
  id: string;
  subject: "programming";
  title: string;
  topic: string;
  difficulty: Difficulty;
  estMinutes: number;
  statement: string; // markdown
  language: "javascript" | "python";
  starterCode: string;
  testCases: { input: string; expected: string }[];
  hint?: string;
}

export type Problem = MathProblem | ProgrammingProblem;

export const PROBLEMS: Problem[] = [
  {
    id: "quadratic-factoring",
    subject: "math",
    title: "Quadratic factoring",
    topic: "Algebra",
    difficulty: "easy",
    estMinutes: 5,
    statement:
      "Factor the quadratic expression and find its roots:\n\n$$x^2 - x - 6 = 0$$\n\nWork through it step by step.",
    steps: [
      {
        id: "find-factors",
        prompt:
          "Find two numbers that multiply to -6 and add to -1. Enter them separated by a comma (e.g. 3,-2).",
        expectedAnswer: "-3,2",
        hint: "Think about pairs of factors of 6 and which sign combination gives -1 when added.",
      },
      {
        id: "factored-form",
        prompt:
          "Write the factored form. Use parentheses like (x+a)(x+b).",
        expectedAnswer: "(x-3)(x+2)",
        hint: "Each factor takes the form (x - root).",
      },
      {
        id: "roots",
        prompt: "List the two roots, separated by a comma.",
        expectedAnswer: "3,-2",
      },
    ],
    finalAnswer: "x = 3 or x = -2",
  },
  {
    id: "chain-rule",
    subject: "math",
    title: "Chain rule derivative",
    topic: "Calculus",
    difficulty: "medium",
    estMinutes: 7,
    statement:
      "Differentiate the following function with respect to $x$:\n\n$$f(x) = \\sin(3x^2 + 1)$$",
    steps: [
      {
        id: "outer",
        prompt:
          "What is the derivative of the OUTER function sin(u) with respect to u?",
        expectedAnswer: "cos(u)",
      },
      {
        id: "inner",
        prompt:
          "What is the derivative of the INNER function u = 3x^2 + 1 with respect to x?",
        expectedAnswer: "6x",
      },
      {
        id: "combine",
        prompt:
          "Combine via the chain rule. Write f'(x) using cos(...) and the inner derivative.",
        expectedAnswer: "6x*cos(3x^2+1)",
      },
    ],
    finalAnswer: "f'(x) = 6x · cos(3x^2 + 1)",
  },
  {
    id: "integration-by-parts",
    subject: "math",
    title: "Integration by parts",
    topic: "Calculus",
    difficulty: "hard",
    estMinutes: 10,
    statement:
      "Evaluate the indefinite integral:\n\n$$\\int x \\cdot e^x \\, dx$$\n\nUse integration by parts: $\\int u\\,dv = uv - \\int v\\,du$.",
    steps: [
      {
        id: "choose-u",
        prompt:
          "Choose u. (Pick the part that simplifies when differentiated.)",
        expectedAnswer: "x",
        hint: "LIATE: prefer the algebraic part as u.",
      },
      {
        id: "choose-dv",
        prompt: "Then dv = ?",
        expectedAnswer: "e^x dx",
      },
      {
        id: "compute-du-v",
        prompt:
          "Give du and v as a comma-separated pair (e.g. 'dx, e^x').",
        expectedAnswer: "dx,e^x",
      },
      {
        id: "result",
        prompt:
          "Apply uv - ∫v du and write the final answer (include + C).",
        expectedAnswer: "x*e^x-e^x+C",
      },
    ],
    finalAnswer: "x·e^x − e^x + C",
  },
  {
    id: "two-sum",
    subject: "programming",
    title: "Two Sum",
    topic: "Arrays / Hashing",
    difficulty: "easy",
    estMinutes: 8,
    language: "javascript",
    statement:
      "Given an array of integers `nums` and a target integer `target`, return the indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input has exactly one solution, and you may not use the same element twice.\n\n**Example**\n\n```\nnums = [2, 7, 11, 15], target = 9\nreturn [0, 1]   // because nums[0] + nums[1] == 9\n```",
    starterCode: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function twoSum(nums, target) {
  // your code here
}
`,
    testCases: [
      { input: "[2,7,11,15], 9", expected: "[0,1]" },
      { input: "[3,2,4], 6", expected: "[1,2]" },
      { input: "[3,3], 6", expected: "[0,1]" },
    ],
    hint: "A hash map can turn this into a single pass.",
  },
  {
    id: "fizzbuzz-plus",
    subject: "programming",
    title: "FizzBuzz Plus",
    topic: "Control flow",
    difficulty: "easy",
    estMinutes: 6,
    language: "javascript",
    statement:
      "Write a function `fizzbuzz(n)` that returns an array of strings of length `n`.\n\nFor each i from 1 to n:\n- If i is divisible by 15, push `\"FizzBuzz\"`.\n- Else if divisible by 3, push `\"Fizz\"`.\n- Else if divisible by 5, push `\"Buzz\"`.\n- Else if i is a prime, push `\"Prime\"`.\n- Otherwise push the number as a string.",
    starterCode: `/**
 * @param {number} n
 * @return {string[]}
 */
function fizzbuzz(n) {
  // your code here
}
`,
    testCases: [
      {
        input: "5",
        expected: '["1","Prime","Fizz","4","Buzz"]',
      },
      {
        input: "15",
        expected:
          '["1","Prime","Fizz","4","Buzz","Fizz","Prime","8","Fizz","Buzz","Prime","Fizz","Prime","14","FizzBuzz"]',
      },
    ],
    hint: "Check the FizzBuzz conditions BEFORE the prime check.",
  },
];

export function getProblem(id: string): Problem | undefined {
  return PROBLEMS.find((p) => p.id === id);
}

export function problemsBySubject(subject: Subject): Problem[] {
  return PROBLEMS.filter((p) => p.subject === subject);
}
