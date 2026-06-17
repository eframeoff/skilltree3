-- =============================================================================
-- SkillTree — Postgres / Supabase schema (Phase Б, see docs/adr/0002).
--
-- Design choice: a tree's curriculum (levels / nodes / published snapshot) is a
-- nested, position-bearing graph that the app already treats as one serializable
-- blob — so it lives in JSONB, mirroring the JS model in src/data/treeUtils.js.
-- Everything that is QUERIED or ACCESS-CONTROLLED (enrollments, progress facts,
-- attempts, reviewers, messages) is relational so RLS and filters work.
--
-- Принцип из ADR-0002: храним только ФАКТЫ прогресса (completed/in_progress);
-- locked/available по-прежнему выводятся на клиенте (recomputeProgress).
-- Apply with the Supabase SQL editor or `supabase db push`.
-- =============================================================================

-- ── Profiles (mirror of auth.users) ─────────────────────────────────────────
create type user_role as enum ('student', 'instructor');

create table profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  role          user_role not null default 'student',
  name          text not null,
  email         text,
  avatar_color  text default '#38bdf8',
  headline      text,
  skins         jsonb not null default '[]',   -- unlocked node skins (shop)
  created_at    timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user signs up.
-- NOTE: security-definer trigger MUST set search_path (and schema-qualify the
-- table) — otherwise GoTrue's call can't resolve `profiles` and user creation
-- fails with a 500 "Database error".
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.email), new.email);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Trees (curriculum as JSONB) ──────────────────────────────────────────────
create type tree_status as enum ('draft', 'published');
create type gating_mode as enum ('levels', 'graph');

create table trees (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references profiles (id) on delete cascade,
  title       text not null default 'Новое дерево навыков',
  category    text default 'Без категории',
  emoji       text default '🌳',
  color       text default '#2DD4FF',
  description text default '',
  status      tree_status not null default 'draft',
  gating      gating_mode not null default 'levels',
  tags        jsonb not null default '[]',   -- catalog hashtags
  levels      jsonb not null default '[]',   -- [{ level, label, color }]
  nodes       jsonb not null default '[]',   -- draft: [{ id,title,level,x,y,prereqs,teach,submit,grade,delegation,checkpoint,... }]
  published   jsonb,                          -- snapshot students read: { levels, nodes, gating }
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index trees_author_idx on trees (author_id);
create index trees_status_idx on trees (status);

-- Co-authors / co-coaches (relational for RLS; JS keeps tree.collaborators).
create type collab_role as enum ('co-author', 'co-coach');
create table tree_collaborators (
  tree_id  uuid references trees (id) on delete cascade,
  user_id  uuid references profiles (id) on delete cascade,
  role     collab_role not null default 'co-author',
  primary key (tree_id, user_id)
);

-- Student-mentors granted per tree, optionally scoped (e.g. {"maxLevel": 2}).
create table tree_mentors (
  tree_id  uuid references trees (id) on delete cascade,
  user_id  uuid references profiles (id) on delete cascade,
  scope    jsonb,
  since    timestamptz not null default now(),
  primary key (tree_id, user_id)
);

-- ── Enrollments (student ↔ tree ↔ primary coach) ─────────────────────────────
create table enrollments (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references profiles (id) on delete cascade,
  tree_id     uuid not null references trees (id) on delete cascade,
  coach_id    uuid references profiles (id),
  created_at  timestamptz not null default now(),
  unique (student_id, tree_id)
);
create index enrollments_tree_idx on enrollments (tree_id);
create index enrollments_coach_idx on enrollments (coach_id);

-- Extra reviewers on a specific enrollment (co-coach assigned to one student).
create table enrollment_reviewers (
  enrollment_id uuid references enrollments (id) on delete cascade,
  user_id       uuid references profiles (id) on delete cascade,
  role          text not null,        -- 'co-coach' | 'mentor'
  scope         jsonb,
  primary key (enrollment_id, user_id)
);

-- ── Progress facts (only completed / in_progress are stored) ─────────────────
create type node_status as enum ('in_progress', 'completed');
create table progress (
  student_id  uuid references profiles (id) on delete cascade,
  tree_id     uuid references trees (id) on delete cascade,
  node_id     text not null,                 -- node id lives inside trees.nodes JSONB
  status      node_status not null,
  rating      smallint,                      -- 1..5 stars when graded
  reviewer_id uuid references profiles (id),
  provisional boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (student_id, tree_id, node_id)
);

-- ── Attempts (was `videos`; carries multi-part submissions) ──────────────────
create type attempt_status as enum ('pending', 'approved', 'rejected');
create table attempts (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null references profiles (id) on delete cascade,
  tree_id           uuid not null references trees (id) on delete cascade,
  node_id           text not null,
  type              text,                    -- legacy hint: practice|exam|live
  status            attempt_status not null default 'pending',
  rating            smallint,
  reviewer_id       uuid references profiles (id),
  reviewer_role     text,                    -- 'coach' | 'mentor'
  provisional       boolean not null default false,
  label             text,
  thumb             text,
  duration          text,
  feedback          text,
  parts             jsonb not null default '[]', -- [{ kind:'video|photo|text|embed', payload }]
  compilation_ready boolean default false,
  is_featured       boolean default false,
  created_at        timestamptz not null default now()
);
create index attempts_review_idx on attempts (tree_id, status);
create index attempts_student_idx on attempts (student_id, tree_id, node_id);

-- ── Node-scoped chat ─────────────────────────────────────────────────────────
create table messages (
  id          uuid primary key default gen_random_uuid(),
  tree_id     uuid not null references trees (id) on delete cascade,
  student_id  uuid not null references profiles (id) on delete cascade,
  node_id     text not null,
  sender_id   uuid not null references profiles (id),
  body        text not null,
  edited      boolean not null default false,
  created_at  timestamptz not null default now()
);
create index messages_thread_idx on messages (tree_id, student_id, node_id);

-- Read receipts: last time a participant read a (student, tree) thread.
create table chat_reads (
  tree_id    uuid references trees (id) on delete cascade,
  student_id uuid references profiles (id) on delete cascade,
  reader_id  uuid references profiles (id) on delete cascade,
  last_read  timestamptz not null default now(),
  primary key (tree_id, student_id, reader_id)
);

-- ── Media assets (Phase 7 / ADR-0001) — own storage; embeds keep just a URL ──
create table media_assets (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references profiles (id) on delete cascade,
  attempt_id   uuid references attempts (id) on delete cascade,
  kind         text not null,               -- video|photo|audio|file|embed
  storage_path text,                         -- Supabase Storage key (hosted)
  external_url text,                          -- for embed parts (tiktok/ig/youtube)
  created_at   timestamptz not null default now()
);

-- =============================================================================
-- ROW-LEVEL SECURITY (sketch — tighten before production)
-- =============================================================================
alter table profiles             enable row level security;
alter table trees                enable row level security;
alter table tree_collaborators   enable row level security;
alter table tree_mentors         enable row level security;
alter table enrollments          enable row level security;
alter table enrollment_reviewers enable row level security;
alter table progress             enable row level security;
alter table attempts             enable row level security;
alter table messages             enable row level security;
alter table media_assets         enable row level security;

-- Helper: may the current user review (grade/chat) this (student, tree) pair?
-- Head coach OR enrollment reviewer OR tree-level mentor.
create function can_review(p_student uuid, p_tree uuid) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from enrollments e
    where e.student_id = p_student and e.tree_id = p_tree
      and (e.coach_id = auth.uid()
        or exists (select 1 from enrollment_reviewers r where r.enrollment_id = e.id and r.user_id = auth.uid()))
  ) or exists (select 1 from tree_mentors m where m.tree_id = p_tree and m.user_id = auth.uid());
$$;

-- Helper: may the current user edit this tree? Author or co-author.
create function can_edit_tree(p_tree uuid) returns boolean
language sql security definer stable as $$
  select exists (select 1 from trees t where t.id = p_tree and t.author_id = auth.uid())
      or exists (select 1 from tree_collaborators c
                 where c.tree_id = p_tree and c.user_id = auth.uid() and c.role = 'co-author');
$$;

create policy "profiles readable" on profiles for select using (true);
create policy "profiles self update" on profiles for update using (id = auth.uid());

create policy "trees visible" on trees for select
  using (status = 'published' or author_id = auth.uid() or can_edit_tree(id));
create policy "trees insert own" on trees for insert with check (author_id = auth.uid());
create policy "trees edit" on trees for update using (can_edit_tree(id));
create policy "trees delete owner" on trees for delete using (author_id = auth.uid());

create policy "enrollments visible" on enrollments for select
  using (student_id = auth.uid() or coach_id = auth.uid() or can_review(student_id, tree_id));
create policy "enroll self" on enrollments for insert with check (student_id = auth.uid());

create policy "progress visible" on progress for select
  using (student_id = auth.uid() or can_review(student_id, tree_id));
create policy "progress write" on progress for all
  using (student_id = auth.uid() or can_review(student_id, tree_id))
  with check (student_id = auth.uid() or can_review(student_id, tree_id));

create policy "attempts visible" on attempts for select
  using (student_id = auth.uid() or can_review(student_id, tree_id));
create policy "attempts student insert" on attempts for insert with check (student_id = auth.uid());
create policy "attempts reviewer update" on attempts for update
  using (student_id = auth.uid() or can_review(student_id, tree_id));

create policy "messages visible" on messages for select
  using (student_id = auth.uid() or can_review(student_id, tree_id));
create policy "messages send" on messages for insert
  with check (sender_id = auth.uid() and (student_id = auth.uid() or can_review(student_id, tree_id)));
create policy "messages edit own" on messages for update
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());

-- collaborators / mentors / reviewers: manage by tree author / owner —
-- left as a follow-up to keep this sketch readable.

-- ── Storage (Phase 7) ────────────────────────────────────────────────────────
-- Private bucket 'attempts' is created by scripts/setup-storage.mjs. These
-- policies let signed-in users upload and view attempt media. Coarse for the
-- prototype (any authenticated user); production should scope by path/ownership.
create policy "attempts upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'attempts');
create policy "attempts read" on storage.objects for select to authenticated
  using (bucket_id = 'attempts');
