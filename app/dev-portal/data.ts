// ── TYPES ───────────────────────────────────────────

export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type Status = 'backlog' | 'sprint_todo' | 'in_progress' | 'review' | 'done';
export type StoryType = 'feature' | 'bug' | 'tech_debt' | 'spike';

export interface Epic {
  id: string;
  name: string;
  color: string;
  description: string;
}

export interface Comment {
  id: string;
  devName: string;
  text: string;
  timestamp: string;
}

export interface UserStory {
  id: string;
  epicId: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: Priority;
  points: number;
  status: Status;
  type: StoryType;
  sprint?: number;
  assignee?: string;
  tags: string[];
  createdAt: string;
  comments: Comment[];
  blockedBy?: string[];
}

export interface Sprint {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  goal: string;
  status: 'planning' | 'active' | 'completed';
}

export interface TeamMember {
  id: string;
  name: string;
  avatar: string;
  color: string;
  ai: string;
  joinedAt: string;
}

export interface Session {
  id: string;
  devId: string;
  devName: string;
  storyId: string;
  ai: string;
  startedAt: string;
  endedAt?: string;
  hours?: number;
}

export interface Activity {
  id: string;
  devName: string;
  action: string;
  storyId?: string;
  timestamp: string;
}

export interface StandupEntry {
  id: string;
  devName: string;
  date: string;
  yesterday: string;
  today: string;
  blockers: string;
}

export interface RetroEntry {
  id: string;
  sprintId: number;
  date: string;
  wentWell: string[];
  toImprove: string[];
  actions: string[];
}

export interface DoDItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface WikiEntry {
  id: string;
  title: string;
  content: string;
  author: string;
  updatedAt: string;
}

export interface ChangelogEntry {
  id: string;
  version: string;
  date: string;
  changes: string[];
  author: string;
}

export interface Notification {
  id: string;
  type: 'warning' | 'info' | 'success';
  message: string;
  storyId?: string;
  read: boolean;
  timestamp: string;
}

// ── CONSTANTS ───────────────────────────────────────

export const STATUS_CONFIG: Record<Status, { label: string; color: string }> = {
  backlog: { label: 'Backlog', color: 'gray' },
  sprint_todo: { label: 'To Do', color: 'blue' },
  in_progress: { label: 'En Progreso', color: 'amber' },
  review: { label: 'En Review', color: 'purple' },
  done: { label: 'Hecho', color: 'emerald' },
};

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string }> = {
  critical: { label: 'Crítica', color: 'red' },
  high: { label: 'Alta', color: 'orange' },
  medium: { label: 'Media', color: 'amber' },
  low: { label: 'Baja', color: 'gray' },
};

export const EPIC_COLORS: Record<string, string> = {
  emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
  cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  pink: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  teal: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  indigo: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
};

export const PRIORITY_DOT: Record<Priority, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-gray-500',
};

export const MEMBER_COLORS: Record<string, string> = {
  emerald: 'bg-emerald-600',
  blue: 'bg-blue-600',
  purple: 'bg-purple-600',
  amber: 'bg-amber-600',
  red: 'bg-red-600',
  cyan: 'bg-cyan-600',
  pink: 'bg-pink-600',
  orange: 'bg-orange-600',
};

export const DOD_DEFAULT: DoDItem[] = [
  { id: '1', text: 'Código compila sin errores', checked: false },
  { id: '2', text: 'Criterios de aceptación cumplidos', checked: false },
  { id: '3', text: 'Code review aprobado', checked: false },
  { id: '4', text: 'Sin console.log ni código de debug', checked: false },
  { id: '5', text: 'Responsive (móvil y desktop)', checked: false },
  { id: '6', text: 'Commit con formato estándar', checked: false },
];

export const DOCS = [
  { file: '01-vision-producto.md', title: 'Visión del Producto', desc: 'Visión, propuesta de valor, público objetivo, modelo de negocio SaaS y objetivos' },
  { file: '02-arquitectura.md', title: 'Arquitectura del Sistema', desc: 'Stack tecnológico, estructura de carpetas, flujo de datos y patrones de diseño' },
  { file: '03-modelo-datos.md', title: 'Modelo de Datos', desc: 'Entidades, relaciones, esquema SQL de Supabase y políticas RLS' },
  { file: '04-guia-desarrollo.md', title: 'Guía de Desarrollo', desc: 'Instalación, comandos, convenciones, flujo Git y cómo agregar features' },
  { file: '05-api-reference.md', title: 'API Reference', desc: 'Servicios de DB, Store actions, Auth context y endpoints futuros' },
  { file: '06-seguridad.md', title: 'Seguridad', desc: 'Autenticación, RBAC, OWASP top 10, plan de mejoras de seguridad' },
  { file: '07-despliegue.md', title: 'Guía de Despliegue', desc: 'Vercel, Docker, Supabase producción, CI/CD y monitoreo' },
  { file: '08-guia-usuario.md', title: 'Guía de Usuario', desc: 'Manual de uso: reservas, barbero, admin y configuración' },
];
