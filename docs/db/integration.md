# Backend integration plan (Phase Б)

How the in-memory prototype becomes a Supabase-backed app. Schema:
[schema.sql](schema.sql). Decision: [../adr/0002-backend-and-persistence.md](../adr/0002-backend-and-persistence.md).

## The one seam

All state lives behind `StoreContext` (`src/context/StoreContext.jsx`). Today it
reads/writes React state persisted to `localStorage`
(`src/hooks/usePersistentState.js`). The swap is contained: replace those
read/write helpers with Supabase queries; the component API the screens consume
(`store.nodesFor`, `store.acceptVideo`, …) stays identical.

Recommended shape: a `src/data/backend.js` adapter with the same method names the
store exposes, plus realtime subscriptions that update local state. The store
becomes a thin cache + optimistic-update layer over the adapter.

## Mapping store → tables

| Store concept | Table(s) |
|---|---|
| `trees` (draft `nodes`/`levels`, `published`) | `trees` (JSONB columns) |
| `addCollaborator` / `removeCollaborator` | `tree_collaborators` |
| `grantMentor` / `revokeMentor` | `tree_mentors` |
| `enrollments` (+ `addReviewer`) | `enrollments`, `enrollment_reviewers` |
| `progress` facts (`setFact`) | `progress` (PK student+tree+node) |
| `submitVideo` / `acceptVideo` / `rejectVideo` / `attestLive` | `attempts` |
| `sendMessage` | `messages` |
| media files (Phase 7) | Supabase Storage + `media_assets` |

`recomputeProgress` / `enrichNodes` / `treeStats` stay **client-side, pure** —
they derive locked/available from stored facts on read. Nothing changes there.

## Auth

`AuthContext` → Supabase Auth. `profiles` row auto-created by the
`on_auth_user_created` trigger. `user.role` comes from `profiles.role`. The
existing role-gated routing (`RequireRole`) is unchanged.

## Reads that must use the published snapshot

Student-facing reads already route through `publishedView` in the store
(`viewTree`, `nodesFor`, `edgesOf`, `stats`). Server-side: students select
`trees.published`; coaches/co-authors select `trees.nodes` (draft). RLS lets a
student read a tree row when `status='published'`; the app picks the `published`
JSONB. `publishTreeUpdate` writes `published = { levels, nodes, gating }`.

## Access control parity

The store's JS guards map 1:1 onto RLS helpers in the schema:

- `can_review(student, tree)` ↔ `videosForCoach` / `videosForMentor` routing +
  `confirmProvisional` rights (head coach, enrollment reviewer, or tree mentor).
- `can_edit_tree(tree)` ↔ the editor `canEdit` guard (author or co-author).
- anti-self-review (`videosForMentor` excludes own) → enforce in the policy /
  an attempt-update check (`reviewer_id <> student_id`).

## Seed migration

`src/data/users.js` + `src/data/trees/*` are the dev seed. A one-off script
inserts profiles, trees (run each through `migrateTree` first so JSONB carries
the current axes), enrollments, progress, attempts, messages. Bump
`usePersistentState` `VERSION` is no longer needed once the server is source of
truth; `localStorage` becomes an offline cache (or is dropped).

## Cutover order

1. Auth + `profiles` (login works against Supabase).
2. `trees` read/write (editor + catalog).
3. `enrollments` + `progress` + `attempts` + `messages` (the learning loop).
4. Storage for real media (Phase 7 / ADR-0001) — direct presigned upload.
5. Realtime subscriptions (coach sees new attempts live).

Do **not** start media (Phase 7) before steps 1–4: uploads need auth + storage +
the attempts table in place.
