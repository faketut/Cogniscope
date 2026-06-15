import { notFound } from "next/navigation";
import { getProblem } from "@/content/problems";
import { BehaviorRecorderProvider } from "@/components/behavior/BehaviorRecorder";
import { MathPractice } from "@/components/practice/MathPractice";
import { CodePractice } from "@/components/practice/CodePractice";

interface PageProps {
  params: { id: string };
}

export default function PracticePage({ params }: PageProps) {
  const problem = getProblem(params.id);
  if (!problem) notFound();

  return (
    <BehaviorRecorderProvider problemId={problem.id}>
      {problem.subject === "math" ? (
        <MathPractice problem={problem} />
      ) : (
        <CodePractice problem={problem} />
      )}
    </BehaviorRecorderProvider>
  );
}
