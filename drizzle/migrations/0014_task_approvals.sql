-- 0014: task completion approvals.
--
-- An employee who marks a task Done does not close it silently: the task keeps
-- its status but carries approval_status = 'pending' until their manager (or an
-- administrator) approves or rejects it. Rejecting puts the task back to In
-- Progress with the reviewer's note. The decision function runs server-side,
-- and this policy lets a direct manager's own session write the decision even
-- when they do not hold the manager role.

alter table public.team_tasks
  add column if not exists approval_status text not null default 'none',
  add column if not exists approval_note text,
  add column if not exists approval_by uuid references auth.users(id) on delete set null,
  add column if not exists approval_at timestamptz;

alter table public.team_tasks drop constraint if exists team_tasks_approval_status_check;
alter table public.team_tasks
  add constraint team_tasks_approval_status_check
  check (approval_status in ('none', 'pending', 'approved', 'rejected'));

create index if not exists team_tasks_pending_approval_idx
  on public.team_tasks (approval_status)
  where approval_status = 'pending';

-- A teammate's own manager may decide the tasks of the people who report to
-- them. Staff keep their existing admin/manager policies.
drop policy if exists "Direct managers decide task approvals" on public.team_tasks;
create policy "Direct managers decide task approvals" on public.team_tasks
  for update to authenticated
  using (
    exists (
      select 1
        from public.team_members m
        join public.team_members me on me.id = m.manager_id
       where m.id = team_tasks.member_id
         and me.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
        from public.team_members m
        join public.team_members me on me.id = m.manager_id
       where m.id = team_tasks.member_id
         and me.user_id = auth.uid()
    )
  );

-- Tasks completed before approvals existed count as already accepted.
update public.team_tasks
   set approval_status = 'approved'
 where status = 'Done'
   and approval_status = 'none';
