import { FlagQuestion } from '@/app/components/FlagQuestion';
import type { AttemptQuestion, AttemptResponse } from '@/app/lib/persistence/schema';

interface Props {
  question: AttemptQuestion;
  response: AttemptResponse | undefined;
  index: number;
}

const CHOICE_LETTERS = ['A', 'B', 'C', 'D'] as const;

// Server component. Renders one question with the user's selection marked +
// the correct answer + the explanation. Hosts the <FlagQuestion/> client
// widget at the bottom — this is the single inclusion point shared by the
// post-test results review AND /dashboard/attempts/[id].
export function ReviewItem({ question, response, index }: Props) {
  const choices = Array.isArray(question.choices) ? question.choices : [];
  const userPicked = response?.selected ?? null;
  const correct = question.answer_key ?? null;
  const isCorrect = response?.is_correct ?? null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <div>
          Q{index + 1} · {question.section} · {question.skill}
          {response?.flagged && (
            <span className="ml-2 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
              flagged
            </span>
          )}
        </div>
        <div>
          {isCorrect == null ? (
            <span className="text-slate-400">not graded</span>
          ) : isCorrect ? (
            <span className="rounded bg-green-100 px-2 py-0.5 font-medium text-green-700">
              correct
            </span>
          ) : (
            <span className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-700">
              {userPicked == null ? 'unanswered' : 'incorrect'}
            </span>
          )}
        </div>
      </div>

      <div className="mb-3 whitespace-pre-wrap text-sm text-slate-800">{question.stem}</div>

      <ol className="mb-3 space-y-1.5">
        {choices.map((text, i) => {
          const letter = CHOICE_LETTERS[i];
          if (!letter) return null;
          const isUser = letter === userPicked;
          const isAns = letter === correct;
          return (
            <li
              key={letter}
              className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                isAns
                  ? 'border-green-300 bg-green-50'
                  : isUser
                    ? 'border-red-300 bg-red-50'
                    : 'border-slate-200'
              }`}
            >
              <span className="w-5 font-semibold text-slate-700">{letter}.</span>
              <span className="flex-1 text-slate-800">{text}</span>
              {isAns && (
                <span className="text-xs font-medium text-green-700">correct answer</span>
              )}
              {isUser && !isAns && (
                <span className="text-xs font-medium text-red-700">your answer</span>
              )}
              {isUser && isAns && (
                <span className="text-xs font-medium text-green-700">your answer</span>
              )}
            </li>
          );
        })}
      </ol>

      {question.explanation && (
        <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          <div className="mb-1 text-xs font-semibold uppercase text-slate-500">
            Explanation
          </div>
          <div className="whitespace-pre-wrap">{question.explanation}</div>
        </div>
      )}

      <FlagQuestion questionId={question.question_id} />
    </div>
  );
}
