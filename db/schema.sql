-- =============================================================================
-- SkillTree — SaaS-платформа геймифицированного No-Code обучения
-- PostgreSQL schema (Phase 2 target; the current prototype runs on mock data)
--
-- Design notes:
--   * MULTI-TENANT: every skill tree is OWNED by an author (coach). Authors
--     build trees in the no-code editor; students enroll via catalog or an
--     invite link. Progress is per (student, tree).
--   * Node pass criteria by node_type:
--       'test'     — auto-checked quiz inside the app (questions in nodes.quiz)
--       'practice' — student uploads a video draft, the coach approves it
--       'exam'     — video exam graded 1–5 stars; blocks level progression
--   * Tree topology (which node unlocks which) is data, not code: see
--     node_prerequisites. Unlock logic is computed against student progress.
--   * compilation_ready / is_featured flags let the "highlights engine" query
--     approved clips for social reposts & auto-compilations.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";

-- ---------- ENUM TYPES --------------------------------------------------------
CREATE TYPE user_role         AS ENUM ('student', 'author', 'admin');
CREATE TYPE tree_status       AS ENUM ('draft', 'published', 'archived');
CREATE TYPE node_type         AS ENUM ('test', 'practice', 'exam');
CREATE TYPE progress_status   AS ENUM ('locked', 'available', 'in_progress', 'completed');
CREATE TYPE video_type        AS ENUM ('practice', 'exam');
CREATE TYPE submission_status AS ENUM ('pending', 'approved', 'rejected');

-- =============================================================================
-- USERS
-- =============================================================================
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role          user_role   NOT NULL,
    full_name     TEXT        NOT NULL,
    email         CITEXT      NOT NULL UNIQUE,
    headline      TEXT,                          -- author tagline ("Преподаватель гитары")
    avatar_url    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- SKILL TREES (author-owned curricula — the product of the no-code editor)
-- =============================================================================
CREATE TABLE skill_trees (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title         TEXT        NOT NULL,
    category      TEXT,                          -- "Спорт", "Музыка", …
    emoji         TEXT,                          -- catalog card icon
    color         TEXT,                          -- brand tint (hex)
    description   TEXT,
    status        tree_status NOT NULL DEFAULT 'draft',
    invite_code   TEXT        UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trees_author    ON skill_trees(author_id);
CREATE INDEX idx_trees_published ON skill_trees(status) WHERE status = 'published';

-- Sequentially-gated levels inside a tree (mastering level N opens N+1).
CREATE TABLE tree_levels (
    tree_id       UUID NOT NULL REFERENCES skill_trees(id) ON DELETE CASCADE,
    level         INT  NOT NULL,
    label         TEXT NOT NULL,                 -- "ЖИВОТ", "БАЗА", …
    color         TEXT NOT NULL DEFAULT '#2DD4FF',
    PRIMARY KEY (tree_id, level)
);

CREATE TABLE nodes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id       UUID        NOT NULL REFERENCES skill_trees(id) ON DELETE CASCADE,
    node_type     node_type   NOT NULL,
    title         TEXT        NOT NULL,
    description   TEXT,
    level         INT         NOT NULL DEFAULT 1, -- FK (tree_id, level) → tree_levels
    position_x    NUMERIC(7,2) NOT NULL,          -- virtual canvas coords (PoE-style)
    position_y    NUMERIC(7,2) NOT NULL,
    optional      BOOLEAN     NOT NULL DEFAULT FALSE, -- side-quest: doesn't gate levels
    steps         JSONB,                          -- instruction steps  ["…", "…"]
    quiz          JSONB,                          -- [{q, options: [..], answer: int}]
    guide_video_url TEXT,                         -- author's reference video
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (tree_id, level) REFERENCES tree_levels(tree_id, level) ON DELETE CASCADE
);
CREATE INDEX idx_nodes_tree ON nodes(tree_id);

-- Directed edges: prerequisite_node_id must be completed before node_id unlocks.
CREATE TABLE node_prerequisites (
    node_id              UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    prerequisite_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    PRIMARY KEY (node_id, prerequisite_node_id),
    CHECK (node_id <> prerequisite_node_id)
);

-- =============================================================================
-- ENROLLMENTS  (student joins a tree; coach defaults to the tree's author)
-- =============================================================================
CREATE TABLE enrollments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tree_id       UUID        NOT NULL REFERENCES skill_trees(id) ON DELETE CASCADE,
    coach_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Privacy: by default only the coach sees the student's tree.
    is_public     BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, tree_id)
);
CREATE INDEX idx_enrollments_coach   ON enrollments(coach_id);
CREATE INDEX idx_enrollments_student ON enrollments(student_id);

-- =============================================================================
-- STUDENT_NODE_PROGRESS  (per-student state of each node)
-- =============================================================================
CREATE TABLE student_node_progress (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    node_id       UUID        NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    status        progress_status NOT NULL DEFAULT 'locked',
    -- best_rating mirrors the rating of the approved exam video (denormalized
    -- for fast tree rendering — the source of truth is video_submissions).
    best_rating   SMALLINT    CHECK (best_rating BETWEEN 1 AND 5),
    unlocked_at   TIMESTAMPTZ,
    completed_at  TIMESTAMPTZ,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, node_id)
);
CREATE INDEX idx_progress_student ON student_node_progress(student_id);

-- =============================================================================
-- VIDEO_SUBMISSIONS  (the heart of the video-attestation model)
-- =============================================================================
CREATE TABLE video_submissions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    node_id           UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    video_type        video_type       NOT NULL,
    -- Storage pointers (Phase 2: Mux / Cloudflare Stream / S3+CloudFront).
    video_url         TEXT,
    thumbnail_url     TEXT,
    duration_seconds  INT,
    status            submission_status NOT NULL DEFAULT 'pending',
    rating            SMALLINT CHECK (rating BETWEEN 1 AND 5),  -- exam grade
    feedback          TEXT,
    -- Highlights / repost engine flags:
    is_featured        BOOLEAN NOT NULL DEFAULT FALSE,  -- manually starred clip
    compilation_ready  BOOLEAN NOT NULL DEFAULT FALSE,  -- eligible for auto-edit
    reviewed_by       UUID REFERENCES users(id),
    reviewed_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- A rating only makes sense for exam videos that were approved.
    CHECK (rating IS NULL OR (video_type = 'exam' AND status = 'approved'))
);
CREATE INDEX idx_videos_node_student ON video_submissions(node_id, student_id);
CREATE INDEX idx_videos_pending      ON video_submissions(status) WHERE status = 'pending';
CREATE INDEX idx_videos_compilation  ON video_submissions(compilation_ready) WHERE compilation_ready;

-- One student may upload MANY practice drafts per node, but only ONE definitive
-- APPROVED exam video per node. Pending/rejected exam re-takes are allowed.
CREATE UNIQUE INDEX uniq_approved_exam_per_node
    ON video_submissions (student_id, node_id)
    WHERE video_type = 'exam' AND status = 'approved';

-- =============================================================================
-- NODE_CONTEXT_MESSAGES  (contextual chat scoped to a single node)
-- =============================================================================
CREATE TABLE node_context_messages (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id       UUID        NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    student_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- thread owner
    sender_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- who wrote it
    body          TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_msgs_thread ON node_context_messages(node_id, student_id, created_at);

COMMIT;

-- =============================================================================
-- UNLOCK RULE (reference, enforced in app/service layer):
--   A node becomes 'available' for a student once EVERY prerequisite node is
--   'completed' AND the node's level gate is open (all required, non-optional
--   exams of the PREVIOUS level are completed; the first level has no gate).
--   * 'test' nodes complete instantly when the quiz is passed in-app.
--   * 'practice' nodes complete when the coach approves the uploaded draft.
--   * 'exam' nodes complete when the coach grades the video 1–5 stars.
-- =============================================================================
