# ACT App — Sub-project #7 (Feedback) Design

> Narrower spec built against the overview design. Sub-project #7 lets users flag bad questions from any review surface and lets admins triage them.

**Date:** 2026-05-26
**Status:** Approved
**Tag target:** `post-feedback`

---

## 1. Scope

After this lands:
- Inside any `<ReviewItem/>` (post-test results page + `/dashboard/attempts/[id]`), a user can flag a question with a reason + optional comment.
- The flag becomes a row in `act.question_flags` via `act.submit_flag` security-definer RPC.
- Admins see open flags at `/admin/flags` and can mark them resolved or dismissed.

`act.question_flags` table already exists from Foundation. This sub-project ships the RPC, the UI widget, the admin page, and the resolve action.

**In scope:**
- 1 RPC: `act.submit_flag(p_question uuid, p_reason text, p_notes text)` — security definer, sets user_id := auth.uid()
- `<FlagQuestion/>` client component (reason picker + notes textarea + submit)
- `<ReviewItem/>` includes `<FlagQuestion/>` at the bottom
- `/admin/flags` server page
- `<FlagRow/>` component
- `resolveFlag(formData)` server action — admin-only, role-gated, marks resolved/dismissed via service-role
- `listFlags(status?)`, `countOpenFlags()` queries in `app/lib/admin/flags.ts`
- AdminNav gets an "Open Flags" tab with the open-count badge
- Admin overview dashboard gets an "Open flags" stat card

**Out of scope:**
- User notification when a flag is resolved (deferred)
- Bulk resolve (deferred)
- Hide flagged questions automatically (admins must manually disable via `/admin/questions/[id]`)

---

## 2. RPC

```sql
create or replace function act.submit_flag(p_question uuid, p_reason text, p_notes text)
returns uuid
language plpgsql
security definer
set search_path = act, public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then raise exception 'authenticated user required'; end if;
  if p_reason not in ('incorrect_answer', 'ambiguous', 'typo', 'other') then
    raise exception 'invalid reason: %', p_reason;
  end if;
  if not exists (select 1 from act.questions where id = p_question) then
    raise exception 'question not found';
  end if;

  insert into act.question_flags (user_id, question_id, reason, notes, status)
  values (v_user, p_question, p_reason, p_notes, 'open')
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function act.submit_flag(uuid, text, text) from public;
grant execute on function act.submit_flag(uuid, text, text) to authenticated;
```

---

## 3. File Structure

```
app/
├── components/
│   └── FlagQuestion.tsx                NEW 'use client' widget
├── (app)/admin/flags/
│   └── page.tsx                        admin flag list with filter (open/resolved/dismissed/all)
├── components/admin/
│   └── FlagRow.tsx                     one flag row with resolve form
├── lib/
│   ├── feedback/
│   │   ├── schemas.ts                  zod for submitFlag input
│   │   └── actions.ts                  submitFlag server action
│   └── admin/
│       └── flags.ts                    FILLED IN: listFlags, countOpenFlags, resolveFlag
└── components/review/
    └── ReviewItem.tsx                  MODIFIED: include <FlagQuestion/>

supabase/migrations/20260526060000_act_submit_flag.sql

# AdminNav also gets a new tab.
```

---

## 4. UX

### FlagQuestion widget (inside ReviewItem)

A small disclosure at the bottom of each `<ReviewItem/>`:

> ⚐ Report a problem with this question

Clicking expands to:
- Radio: "Incorrect answer", "Ambiguous wording", "Typo", "Other"
- Textarea: "Anything else? (optional)"
- Submit button

On submit: calls `submitFlag(questionId, reason, notes?)` server action → updates UI to show "Reported. Thanks." → no further action.

If the user already submitted a flag for this question in this review session: show "Already reported." (no second submission).

### `/admin/flags` page

Filter selector: open (default) | resolved | dismissed | all. Below: list of `<FlagRow/>`s. Each row:
- Reason badge (color-coded)
- Truncated question stem (link to `/admin/questions/[id]`)
- User email + timestamp
- Optional notes
- Buttons: "Mark Resolved" / "Dismiss" (forms posting to `resolveFlag`)

Counts at the top: "12 open · 47 resolved · 3 dismissed".

---

## 5. AdminNav + Overview integration

### AdminNav

Add a new tab "Open Flags" between "Generation" and "Settings". Show the open-flag count next to the label: `Open Flags (12)`.

### Admin overview

Replace the placeholder "Open flags" card (currently empty per #6) with a real one: `<countOpenFlags()>` integer + link to `/admin/flags?status=open`.

---

## 6. References

- Overview spec §7 #7
- SAT precedent: `Personal/satpracticereact/sat-app/app/components/FlagQuestion.tsx`, `app/(app)/admin/flags/page.tsx`, `app/components/admin/FlagRow.tsx`, `app/lib/admin/flags.ts`, `app/lib/feedback/actions.ts`
