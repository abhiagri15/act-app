'use client';

import { useTestSession } from '@/app/hooks/useTestSession';
import type { ActSection } from '@/app/lib/act/format';
import type { AttemptPassage, AttemptQuestion, AttemptResponse } from '@/app/lib/persistence/schema';
import { SectionHeader } from './SectionHeader';
import { NumberPalette } from './NumberPalette';
import { QuestionPane } from './QuestionPane';
import { ReviewView } from './ReviewView';
import { MathRunner } from './MathRunner';
import { EnglishRunner } from './EnglishRunner';
import { TwoPaneRunner } from './TwoPaneRunner';

export interface SectionRunnerProps {
  attemptId: string;
  section: ActSection;
  questions: AttemptQuestion[];
  passages: AttemptPassage[];
  endsAt: string;
  initialResponses: AttemptResponse[];
  nextHref: string;
}

// Shared client-side controller. Mounts useTestSession, then dispatches to
// the layout-specific runner (Math single-pane, English inline-marker,
// Reading/Science two-pane).
export function SectionRunner(props: SectionRunnerProps) {
  const session = useTestSession({
    attemptId: props.attemptId,
    section: props.section,
    questions: props.questions,
    endsAt: props.endsAt,
    initialResponses: props.initialResponses,
    nextHref: props.nextHref,
  });

  const { section, questions } = props;
  const currentQuestion = questions[session.currentQuestionIdx];

  const renderQuestionPane = () => {
    if (!currentQuestion) return null;
    const response = session.responses[session.currentQuestionIdx];
    if (!response) return null;
    return (
      <QuestionPane
        question={currentQuestion}
        index={session.currentQuestionIdx}
        total={questions.length}
        response={response}
        onSelect={(choice) => session.setAnswer(session.currentQuestionIdx, choice)}
        onClear={() => session.clearAnswer(session.currentQuestionIdx)}
        onToggleFlag={() => session.toggleFlag(session.currentQuestionIdx)}
        onNext={
          session.currentQuestionIdx < questions.length - 1
            ? () => session.goToQuestion(session.currentQuestionIdx + 1)
            : undefined
        }
        onPrev={
          session.currentQuestionIdx > 0
            ? () => session.goToQuestion(session.currentQuestionIdx - 1)
            : undefined
        }
      />
    );
  };

  const submitting =
    session.submitState === 'submitting' || session.submitState === 'submitted';

  let body: React.ReactNode;
  if (session.isReviewing) {
    body = (
      <ReviewView
        questions={questions}
        responses={session.responses}
        onGoTo={session.goToQuestion}
        onClose={session.exitReview}
        onSubmit={session.submitNow}
        submitting={submitting}
      />
    );
  } else if (section === 'math') {
    body = <MathRunner questionPane={renderQuestionPane()} />;
  } else if (section === 'english') {
    body = (
      <EnglishRunner
        passages={props.passages}
        questions={questions}
        currentQuestion={currentQuestion}
        questionPane={renderQuestionPane()}
        onGoToQuestion={session.goToQuestion}
      />
    );
  } else {
    body = (
      <TwoPaneRunner
        section={section}
        passages={props.passages}
        currentQuestion={currentQuestion}
        questionPane={renderQuestionPane()}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <SectionHeader
        section={section}
        remainingSec={session.remainingSec}
        answeredCount={session.answeredCount}
        total={questions.length}
        onReview={session.goToReview}
        onSubmit={session.submitNow}
        submitting={submitting}
        errorMessage={session.errorMessage}
      />
      <div className="flex-1 overflow-hidden">{body}</div>
      {!session.isReviewing && (
        <NumberPalette
          responses={session.responses}
          currentIndex={session.currentQuestionIdx}
          onSelect={session.goToQuestion}
        />
      )}
    </div>
  );
}
