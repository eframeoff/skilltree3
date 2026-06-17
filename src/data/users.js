// =============================================================================
// People + seed state: enrollments, per-(student, tree) progress, videos, chat.
// "Today" in this prototype is 2026-06-12.
// =============================================================================
import windtunnel from './trees/windtunnel.js';

// Authors / coaches — each owns one or more skill trees on the platform.
export const authors = [
  { id: 'ins-1', role: 'instructor', name: 'Мара Восс',      email: 'mara@skilltree.app',  avatarColor: '#f97316', headline: 'Инструктор по аэротрубе' },
  { id: 'ins-2', role: 'instructor', name: 'Дмитрий Сокол',  email: 'dmitry@skilltree.app', avatarColor: '#22d3ee', headline: 'Футбольный тренер' },
  { id: 'ins-3', role: 'instructor', name: 'Лука Морено',    email: 'luka@skilltree.app',  avatarColor: '#a3e635', headline: 'Преподаватель гитары' },
];

export const students = [
  { id: 'stu-1', role: 'student', name: 'Алекс Риверс',  email: 'alex@mail.com',   avatarColor: '#38bdf8' },
  { id: 'stu-2', role: 'student', name: 'София Чен',     email: 'sofia@mail.com',  avatarColor: '#a78bfa' },
  { id: 'stu-3', role: 'student', name: 'Маркус Ли',     email: 'marcus@mail.com', avatarColor: '#34d399' },
  { id: 'stu-4', role: 'student', name: 'Елена Петрова', email: 'elena@mail.com',  avatarColor: '#fb7185' },
  { id: 'stu-5', role: 'student', name: 'Джек Уилсон',   email: 'jack@mail.com',   avatarColor: '#facc15' },
  { id: 'stu-6', role: 'student', name: 'Ника Орлова',   email: 'nika@mail.com',   avatarColor: '#4ade80' },
];

export const allUsers = [...authors, ...students];

// Runtime user registry. Seed personas are the fallback (used by the login
// screen + before hydration); once the store fetches profiles from Supabase it
// calls setRegistry, so getUser resolves real DB users (uuid ids) everywhere.
let registry = allUsers;
export const setRegistry = (list) => { registry = list && list.length ? list : allUsers; };
export const getUser = (id) => registry.find((u) => u.id === id);
export const usersByRole = (role) => registry.filter((u) => u.role === role);

// ---- Enrollments (student ↔ tree ↔ coach) ---------------------------------
// A student can study several trees at once; the coach defaults to the tree's
// author but is stored per-enrollment (a tree may have hired co-coaches later).
export const enrollments = [
  { studentId: 'stu-1', treeId: 'tree-wind',     coachId: 'ins-1' },
  { studentId: 'stu-2', treeId: 'tree-wind',     coachId: 'ins-1' },
  { studentId: 'stu-2', treeId: 'tree-guitar',   coachId: 'ins-3' },
  { studentId: 'stu-3', treeId: 'tree-football', coachId: 'ins-2' },
  { studentId: 'stu-4', treeId: 'tree-wind',     coachId: 'ins-1' },
  { studentId: 'stu-4', treeId: 'tree-guitar',   coachId: 'ins-3' },
  { studentId: 'stu-5', treeId: 'tree-football', coachId: 'ins-2' },
  { studentId: 'stu-6', treeId: 'tree-wind',     coachId: 'ins-1' },
];

// A fully-mastered wind tree: every node completed, exams graded 4–5★.
const fullyCompletedWind = Object.fromEntries(
  windtunnel.nodes.map((n) => [
    n.id,
    n.type === 'exam' ? { status: 'completed', rating: n.optional ? 4 : 5 } : { status: 'completed' },
  ])
);

// ---- Per-(student, tree) node progress (SEED FACTS) ------------------------
// Only 'completed' (with optional rating) and 'in_progress' are stored; every
// 'available' / 'locked' status is derived from prerequisites at read time.
export const progressByStudent = {
  'stu-6': { 'tree-wind': fullyCompletedWind }, // Ника — освоила всё дерево
  'stu-1': {
    'tree-wind': { // продвинутый — закрыл уровень ЖИВОТ, работает над двойкой
      'l1-safety': { status: 'completed' }, 'l1-pose': { status: 'completed' },
      'l1-boat': { status: 'completed' }, 'l1-chin': { status: 'completed' },
      'l1-headarms': { status: 'completed' }, 'l1-onearm': { status: 'completed' },
      'l1-cat': { status: 'completed' },
      'l1-exam': { status: 'completed', rating: 5 },
      'l1-aff': { status: 'completed' }, 'l1-double': { status: 'completed' },
      'l1-grips': { status: 'in_progress' },
    },
  },
  'stu-2': {
    'tree-wind': { // зачёт на животе на проверке у тренера
      'l1-safety': { status: 'completed' }, 'l1-pose': { status: 'completed' },
      'l1-boat': { status: 'completed' }, 'l1-headarms': { status: 'completed' },
      'l1-onearm': { status: 'completed' },
      'l1-exam': { status: 'in_progress' },
    },
    'tree-guitar': { // параллельно учит гитару
      'g1-parts': { status: 'completed' }, 'g1-posture': { status: 'completed' },
      'g1-chords1': { status: 'completed' },
      'g1-tune': { status: 'in_progress' },
    },
  },
  'stu-3': {
    'tree-football': { // новичок — пас на проверке
      'f1-rules': { status: 'completed' },
      'f1-touch': { status: 'completed' },
      'f1-pass': { status: 'in_progress' },
    },
  },
  'stu-4': {
    'tree-wind': { // эксперт — закрыты ЖИВОТ и СПИНА, осваивает HEAD UP
      'l1-safety': { status: 'completed' }, 'l1-pose': { status: 'completed' },
      'l1-boat': { status: 'completed' }, 'l1-chin': { status: 'completed' },
      'l1-headarms': { status: 'completed' }, 'l1-onearm': { status: 'completed' },
      'l1-krakozyabra': { status: 'completed' }, 'l1-cat': { status: 'completed' },
      'l1-dragon': { status: 'completed' }, 'l1-bee': { status: 'completed' },
      'l1-exam': { status: 'completed', rating: 5 },
      'l1-aff': { status: 'completed' }, 'l1-double': { status: 'completed' },
      'l1-grips': { status: 'completed' }, 'l1-vfs': { status: 'completed' },
      'l1-trans': { status: 'completed', rating: 5 },
      'l2-pose': { status: 'completed' }, 'l2-plank': { status: 'completed' },
      'l2-headarms': { status: 'completed' }, 'l2-cross': { status: 'completed' },
      'l2-bridge': { status: 'completed' }, 'l2-roof': { status: 'completed' },
      'l2-shrimp': { status: 'completed' }, 'l2-mollusk': { status: 'completed' },
      'l2-birch': { status: 'completed' },
      'l2-exam': { status: 'completed', rating: 5 },
      'l2-double': { status: 'completed' }, 'l2-rolls': { status: 'completed' },
      'l2-bb': { status: 'completed', rating: 4 },
      'l2-sit': { status: 'completed' },
      'l2-trans': { status: 'completed', rating: 5 },
      'l3-sit': { status: 'completed' }, 'l3-static': { status: 'completed' },
      'l3-move': { status: 'in_progress' },
    },
    'tree-guitar': { // и одновременно учится играть — зачёт по ритму у Луки
      'g1-parts': { status: 'completed' }, 'g1-posture': { status: 'completed' },
      'g1-chords1': { status: 'completed' }, 'g1-tune': { status: 'completed' },
      'g1-chords2': { status: 'completed' }, 'g1-switch': { status: 'completed' },
      'g1-exam': { status: 'completed', rating: 5 },
      'g2-strum1': { status: 'completed' }, 'g2-strum2': { status: 'completed' },
      'g2-finger': { status: 'completed' },
      'g2-exam': { status: 'in_progress' },
    },
  },
  'stu-5': { 'tree-football': {} }, // только записался — открыт лишь стартовый узел
};

// ---- Video submissions (flat) --------------------------------------------
export const videoSubmissions = [
  // Алекс — закрыл живот (аэротруба)
  { id: 'v-1', studentId: 'stu-1', treeId: 'tree-wind', nodeId: 'l1-pose', type: 'practice', status: 'approved', thumb: '#1f6feb', label: 'Дубль 1', duration: '0:42', feedback: 'Хороший прогиб, расслабь плечи.' },
  { id: 'v-2', studentId: 'stu-1', treeId: 'tree-wind', nodeId: 'l1-pose', type: 'practice', status: 'approved', thumb: '#0d9488', label: 'Дубль 2', duration: '0:51', feedback: 'Теперь ноги симметричны.' },
  { id: 'v-3', studentId: 'stu-1', treeId: 'tree-wind', nodeId: 'l1-exam', type: 'exam', status: 'approved', rating: 5, thumb: '#b45309', label: 'Зачёт', duration: '1:04', feedback: 'Идеально — в подборку!', compilation_ready: true, is_featured: true },
  // София — зачёт на животе на проверке + практика по гитаре
  { id: 'v-4', studentId: 'stu-2', treeId: 'tree-wind', nodeId: 'l1-pose', type: 'practice', status: 'approved', thumb: '#7c3aed', label: 'Дубль 1', duration: '0:39', feedback: 'Отличная нейтральная поза.' },
  { id: 'v-5', studentId: 'stu-2', treeId: 'tree-wind', nodeId: 'l1-exam', type: 'exam', status: 'pending', thumb: '#9333ea', label: 'Попытка зачёта', duration: '0:58' },
  { id: 'v-17', studentId: 'stu-2', treeId: 'tree-guitar', nodeId: 'g1-chords1', type: 'practice', status: 'approved', thumb: '#d97706', label: 'Дубль 1', duration: '0:47', feedback: 'Am звучит чисто, Dm дожимай.' },
  { id: 'v-18', studentId: 'stu-2', treeId: 'tree-guitar', nodeId: 'g1-tune', type: 'practice', status: 'pending', thumb: '#b45309', label: 'Дубль 1', duration: '0:36' },
  // Маркус — черновик паса на проверке (футбол)
  { id: 'v-6', studentId: 'stu-3', treeId: 'tree-football', nodeId: 'f1-pass', type: 'practice', status: 'pending', thumb: '#059669', label: 'Дубль 1', duration: '0:33' },
  // Елена — богатое портфолио (аэротруба + гитара)
  { id: 'v-7',  studentId: 'stu-4', treeId: 'tree-wind', nodeId: 'l1-exam', type: 'exam', status: 'approved', rating: 5, thumb: '#e11d48', label: 'Зачёт', duration: '1:10', feedback: 'Образцово.', compilation_ready: true, is_featured: true },
  { id: 'v-8',  studentId: 'stu-4', treeId: 'tree-wind', nodeId: 'l1-trans', type: 'exam', status: 'approved', rating: 5, thumb: '#db2777', label: 'Зачёт', duration: '0:52', feedback: 'Чистый переход живот↔спина.', compilation_ready: true },
  { id: 'v-9',  studentId: 'stu-4', treeId: 'tree-wind', nodeId: 'l2-exam', type: 'exam', status: 'approved', rating: 5, thumb: '#be123c', label: 'Зачёт', duration: '1:05', feedback: 'Отличный контроль на спине.', compilation_ready: true, is_featured: true },
  { id: 'v-10', studentId: 'stu-4', treeId: 'tree-wind', nodeId: 'l2-bb', type: 'exam', status: 'approved', rating: 4, thumb: '#9d174d', label: 'Зачёт', duration: '1:18', feedback: 'Чуть зажатый выход из бочки.', compilation_ready: true },
  { id: 'v-11', studentId: 'stu-4', treeId: 'tree-wind', nodeId: 'l2-trans', type: 'exam', status: 'approved', rating: 5, thumb: '#7c2d12', label: 'Зачёт', duration: '1:30', feedback: 'Переход в сит — топ!', compilation_ready: true, is_featured: true },
  { id: 'v-19', studentId: 'stu-4', treeId: 'tree-guitar', nodeId: 'g1-exam', type: 'exam', status: 'approved', rating: 5, thumb: '#ca8a04', label: 'Зачёт', duration: '1:42', feedback: 'Песня сыграна без пауз — браво!', compilation_ready: true, is_featured: true },
  { id: 'v-20', studentId: 'stu-4', treeId: 'tree-guitar', nodeId: 'g2-exam', type: 'exam', status: 'pending', thumb: '#a16207', label: 'Попытка зачёта', duration: '2:05' },
  // Ника — полностью пройденное дерево, лучшие моменты по всем уровням
  { id: 'v-12', studentId: 'stu-6', treeId: 'tree-wind', nodeId: 'l1-exam', type: 'exam', status: 'approved', rating: 5, thumb: '#16a34a', label: 'Зачёт', duration: '1:02', feedback: 'Эталонный живот.', compilation_ready: true, is_featured: true },
  { id: 'v-13', studentId: 'stu-6', treeId: 'tree-wind', nodeId: 'l2-exam', type: 'exam', status: 'approved', rating: 5, thumb: '#0ea5e9', label: 'Зачёт', duration: '1:08', feedback: 'Чистая спина.', compilation_ready: true, is_featured: true },
  { id: 'v-14', studentId: 'stu-6', treeId: 'tree-wind', nodeId: 'l3-exam', type: 'exam', status: 'approved', rating: 5, thumb: '#a855f7', label: 'Зачёт', duration: '1:14', feedback: 'Head Up без замечаний.', compilation_ready: true, is_featured: true },
  { id: 'v-15', studentId: 'stu-6', treeId: 'tree-wind', nodeId: 'l4-exam', type: 'exam', status: 'approved', rating: 5, thumb: '#ec4899', label: 'Зачёт', duration: '1:20', feedback: 'Head Down — мастерски.', compilation_ready: true, is_featured: true },
  { id: 'v-16', studentId: 'stu-6', treeId: 'tree-wind', nodeId: 'l5-exam', type: 'exam', status: 'approved', rating: 5, thumb: '#ef4444', label: 'Зачёт', duration: '1:28', feedback: 'Динамика уровня Pro!', compilation_ready: true, is_featured: true },
];

// ---- Node-scoped chat threads (SEED) -------------------------------------
// key: `${treeId}:${studentId}:${nodeId}`
export const messagesByThread = {
  'tree-wind:stu-1:l1-exam': [
    { id: 'm1', senderId: 'stu-1', name: 'Алекс', body: 'Заход был немного быстрым?', at: '09:14' },
    { id: 'm2', senderId: 'ins-1', name: 'Мара',  body: 'Идеально — 5 звёзд. Отличная работа!', at: '09:20' },
  ],
  'tree-wind:stu-2:l1-exam': [
    { id: 'm3', senderId: 'stu-2', name: 'София', body: 'Отправила зачёт на животе, скрещиваю пальцы!', at: '11:02' },
    { id: 'm4', senderId: 'ins-1', name: 'Мара',  body: 'Получила, посмотрю вечером.', at: '11:05' },
  ],
  'tree-guitar:stu-4:g2-exam': [
    { id: 'm5', senderId: 'stu-4', name: 'Елена', body: 'Записала аккомпанемент, темп держала по метроному.', at: '18:40' },
    { id: 'm6', senderId: 'ins-3', name: 'Лука',  body: 'Слышу прогресс! Гляну запись и поставлю оценку.', at: '19:02' },
  ],
};
