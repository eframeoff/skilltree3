// Per-user "last seen message count" per conversation, in localStorage.
// Unread = currentCount - seen. A thread never seen yet is treated as fully
// read (seen ?? count) so a fresh login isn't a wall of false unreads.
const key = (uid, k) => `skilltree:seen:${uid}:${k}`;

export const getSeen = (uid, k) => {
  const v = localStorage.getItem(key(uid, k));
  return v == null ? null : Number(v);
};

export const setSeen = (uid, k, n) => {
  try { localStorage.setItem(key(uid, k), String(n)); } catch { /* quota / private mode */ }
};

export const unreadCount = (uid, k, count) => {
  const seen = getSeen(uid, k);
  return Math.max(0, count - (seen == null ? count : seen));
};
