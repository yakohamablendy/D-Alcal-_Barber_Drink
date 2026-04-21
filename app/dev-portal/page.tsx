'use client';

import { useState, useEffect, useMemo, useCallback, DragEvent } from 'react';
import {
  LayoutDashboard, List, CalendarDays, FileText, BarChart3,
  X, Check, Clock, Zap, Plus, Trash2, Edit3, MessageSquare,
  Tag, Target, Code2, Search, Play, Square, Download,
  Activity as ActivityIcon, Coffee, RotateCcw, Send, Timer,
  Bell, Map, BookOpen, GitBranch, AlertTriangle, Link2, CheckSquare,
  ChevronRight, Users, TrendingUp, Filter, MoreHorizontal, ArrowUpRight,
} from 'lucide-react';
import { formatDistanceToNow, differenceInDays, addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  type UserStory, type Epic, type Sprint, type Status, type Priority, type StoryType,
  type TeamMember, type Session, type Activity, type StandupEntry, type RetroEntry, type Comment,
  type DoDItem, type WikiEntry, type ChangelogEntry, type Notification,
  STATUS_CONFIG, PRIORITY_CONFIG, EPIC_COLORS, PRIORITY_DOT, MEMBER_COLORS, DOCS,
} from './data';

// ── HELPERS ────────────────────────────────────────

async function fetchData<T>(file: string): Promise<T> {
  const res = await fetch(`/api/dev-data/${file}`);
  return res.json();
}
async function saveData(file: string, data: unknown): Promise<void> {
  await fetch(`/api/dev-data/${file}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}
async function patchData(file: string, body: Record<string, unknown>): Promise<void> {
  await fetch(`/api/dev-data/${file}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
function genId(): string { return crypto.randomUUID().slice(0, 8); }
function now(): string { return new Date().toISOString(); }
function today(): string { return now().split('T')[0]; }
function timeAgo(ts: string): string {
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: es }); } catch { return ts; }
}
function exportCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

// ── STATUS / PRIORITY STYLE MAPS ──

const STATUS_BADGE: Record<Status, string> = {
  backlog: 'bg-gray-500/10 text-gray-400 ring-gray-500/20',
  sprint_todo: 'bg-blue-500/10 text-blue-400 ring-blue-500/20',
  in_progress: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
  review: 'bg-purple-500/10 text-purple-400 ring-purple-500/20',
  done: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
};

const STATUS_DOT: Record<Status, string> = {
  backlog: 'bg-gray-400',
  sprint_todo: 'bg-blue-400',
  in_progress: 'bg-amber-400',
  review: 'bg-purple-400',
  done: 'bg-emerald-400',
};

const PRIORITY_BADGE: Record<Priority, string> = {
  critical: 'bg-red-500/10 text-red-400 ring-red-500/20',
  high: 'bg-orange-500/10 text-orange-400 ring-orange-500/20',
  medium: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
  low: 'bg-gray-500/10 text-gray-400 ring-gray-500/20',
};

// ── TABS ───────────────────────────────────────────

type Tab = 'board' | 'backlog' | 'sprints' | 'roadmap' | 'activity' | 'standup' | 'retro' | 'dod' | 'wiki' | 'changelog' | 'docs' | 'metrics';

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard; section?: string }[] = [
  { id: 'board', label: 'Board', icon: LayoutDashboard, section: 'Planificación' },
  { id: 'backlog', label: 'Backlog', icon: List },
  { id: 'sprints', label: 'Sprints', icon: CalendarDays },
  { id: 'roadmap', label: 'Roadmap', icon: Map },
  { id: 'metrics', label: 'Métricas', icon: BarChart3 },
  { id: 'activity', label: 'Actividad', icon: ActivityIcon, section: 'Equipo' },
  { id: 'standup', label: 'Standup', icon: Coffee },
  { id: 'retro', label: 'Retro', icon: RotateCcw },
  { id: 'dod', label: 'Def. of Done', icon: CheckSquare, section: 'Conocimiento' },
  { id: 'wiki', label: 'Wiki', icon: BookOpen },
  { id: 'changelog', label: 'Changelog', icon: GitBranch },
  { id: 'docs', label: 'Documentación', icon: FileText },
];

// ── MAIN ───────────────────────────────────────────

export default function DevPortal() {
  const [tab, setTab] = useState<Tab>('board');
  const [stories, setStories] = useState<UserStory[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [standups, setStandups] = useState<StandupEntry[]>([]);
  const [retros, setRetros] = useState<RetroEntry[]>([]);
  const [dodItems, setDodItems] = useState<DoDItem[]>([]);
  const [wikiEntries, setWikiEntries] = useState<WikiEntry[]>([]);
  const [changelogs, setChangelogs] = useState<ChangelogEntry[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentDev, setCurrentDev] = useState<TeamMember | null>(null);
  const [showDevSelector, setShowDevSelector] = useState(false);
  const [selectedStory, setSelectedStory] = useState<UserStory | null>(null);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [editingStory, setEditingStory] = useState<UserStory | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchData<UserStory[]>('stories'), fetchData<Epic[]>('epics'), fetchData<Sprint[]>('sprints'),
      fetchData<TeamMember[]>('team'), fetchData<Session[]>('sessions'), fetchData<Activity[]>('activity'),
      fetchData<StandupEntry[]>('standups'), fetchData<RetroEntry[]>('retros'), fetchData<DoDItem[]>('dod'),
      fetchData<WikiEntry[]>('wiki'), fetchData<ChangelogEntry[]>('changelog'), fetchData<Notification[]>('notifications'),
    ]).then(([st, ep, sp, tm, se, ac, su, re, dd, wk, cl, no]) => {
      setStories(Array.isArray(st) ? st : []); setEpics(Array.isArray(ep) ? ep : []);
      setSprints(Array.isArray(sp) ? sp : []); setTeam(Array.isArray(tm) ? tm : []);
      setSessions(Array.isArray(se) ? se : []); setActivities(Array.isArray(ac) ? ac : []);
      setStandups(Array.isArray(su) ? su : []); setRetros(Array.isArray(re) ? re : []);
      setDodItems(Array.isArray(dd) ? dd : []); setWikiEntries(Array.isArray(wk) ? wk : []);
      setChangelogs(Array.isArray(cl) ? cl : []); setNotifications(Array.isArray(no) ? no : []);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const newNotifs: Notification[] = [];
    const activeSprint = sprints.find(s => s.status === 'active');
    if (activeSprint) {
      const daysLeft = differenceInDays(new Date(activeSprint.endDate), new Date());
      if (daysLeft <= 3 && daysLeft >= 0) newNotifs.push({ id: 'sprint-end', type: 'warning', message: `Sprint ${activeSprint.id} termina en ${daysLeft} días`, read: false, timestamp: now() });
    }
    stories.filter(s => s.status === 'in_progress' && s.blockedBy?.length).forEach(s => {
      newNotifs.push({ id: `blocked-${s.id}`, type: 'warning', message: `${s.id} está bloqueada por ${s.blockedBy!.join(', ')}`, storyId: s.id, read: false, timestamp: now() });
    });
    if (newNotifs.length > 0) setNotifications(prev => {
      const existing = new Set(prev.map(n => n.id));
      const fresh = newNotifs.filter(n => !existing.has(n.id));
      return [...fresh, ...prev];
    });
  }, [loaded, stories, sprints]);

  useEffect(() => {
    if (!loaded || team.length === 0) return;
    const saved = sessionStorage.getItem('bp-current-dev');
    if (saved) { const found = team.find(m => m.id === saved); if (found) { setCurrentDev(found); return; } }
    setShowDevSelector(true);
  }, [loaded, team]);

  useEffect(() => {
    const s = sessionStorage.getItem('bp-active-session');
    if (s) try { setActiveSession(JSON.parse(s)); } catch { /* */ }
  }, []);

  const logActivity = useCallback(async (action: string, storyId?: string) => {
    if (!currentDev) return;
    const entry: Activity = { id: genId(), devName: currentDev.name, action, storyId, timestamp: now() };
    setActivities(prev => [entry, ...prev]);
    await patchData('activity', { action: 'push', data: entry });
  }, [currentDev]);

  const updateStory = useCallback(async (id: string, updates: Partial<UserStory>) => {
    const updated = stories.map(s => s.id === id ? { ...s, ...updates } : s);
    setStories(updated);
    await saveData('stories', updated);
    if (selectedStory?.id === id) setSelectedStory(prev => prev ? { ...prev, ...updates } : null);
  }, [stories, selectedStory]);

  const selectDev = (m: TeamMember) => { setCurrentDev(m); sessionStorage.setItem('bp-current-dev', m.id); setShowDevSelector(false); };
  const getEpic = (id: string) => epics.find(e => e.id === id);

  const startSession = async (storyId: string) => {
    if (!currentDev) return;
    const s: Session = { id: genId(), devId: currentDev.id, devName: currentDev.name, storyId, ai: currentDev.ai, startedAt: now() };
    setActiveSession(s); sessionStorage.setItem('bp-active-session', JSON.stringify(s));
    setSessions(prev => [s, ...prev]); await patchData('sessions', { action: 'push', data: s });
    await logActivity(`inició sesión en ${storyId}`, storyId);
  };
  const stopSession = async () => {
    if (!activeSession) return;
    const end = now(); const hours = Math.round(((new Date(end).getTime() - new Date(activeSession.startedAt).getTime()) / 3600000) * 100) / 100;
    const completed = { ...activeSession, endedAt: end, hours };
    setSessions(prev => prev.map(s => s.id === activeSession.id ? completed : s));
    await saveData('sessions', sessions.map(s => s.id === activeSession.id ? completed : s));
    sessionStorage.removeItem('bp-active-session');
    await logActivity(`terminó sesión en ${activeSession.storyId} (${hours}h)`, activeSession.storyId);
    setActiveSession(null);
  };

  const unreadNotifs = notifications.filter(n => !n.read).length;

  // ── Loading
  if (!loaded) return (
    <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-[#c9a84c]/30 border-t-[#c9a84c] rounded-full animate-spin" />
        <p className="text-gray-500 text-sm font-[family-name:var(--font-geist)]">Cargando portal...</p>
      </div>
    </div>
  );

  // ── Dev Selector
  if (showDevSelector) return (
    <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center p-4">
      <div className="bg-[#141414] rounded-2xl border border-[#232323] w-full max-w-md overflow-hidden">
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#c9a84c] to-[#8a7332] flex items-center justify-center text-white font-black text-sm font-[family-name:var(--font-playfair)]">BP</div>
            <div>
              <h1 className="text-lg font-semibold text-white font-[family-name:var(--font-geist)]">¿Quién eres?</h1>
              <p className="text-gray-500 text-xs">Selecciona tu perfil para comenzar</p>
            </div>
          </div>
        </div>
        <div className="px-6 pb-4 space-y-2">
          {team.map(m => (
            <button key={m.id} onClick={() => selectDev(m)}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-[#232323] hover:border-[#c9a84c]/30 hover:bg-[#c9a84c]/[0.03] transition-all duration-200 cursor-pointer text-left group">
              <div className={`w-11 h-11 rounded-full ${MEMBER_COLORS[m.color] || 'bg-gray-600'} flex items-center justify-center text-white font-bold text-sm`}>{m.avatar}</div>
              <div className="flex-1">
                <p className="text-white font-medium">{m.name}</p>
                <p className="text-gray-500 text-xs mt-0.5">IA: {m.ai}</p>
              </div>
              <ChevronRight size={16} className="text-gray-600 group-hover:text-[#c9a84c] transition-colors" />
            </button>
          ))}
        </div>
        <div className="px-6 pb-6">
          <AddMemberInline team={team} setTeam={setTeam} onSelect={selectDev} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0c0c0c] flex font-[family-name:var(--font-geist)]">
      {/* ── SIDEBAR ── */}
      <aside className="w-[220px] bg-[#0c0c0c] border-r border-[#1a1a1a] flex flex-col shrink-0 fixed h-screen z-30">
        <div className="p-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#c9a84c] to-[#8a7332] flex items-center justify-center text-white font-black text-[11px] font-[family-name:var(--font-playfair)]">BP</div>
            <div>
              <span className="text-white font-semibold text-sm block leading-tight">Dev Portal</span>
              <span className="text-gray-600 text-[10px]">BarberPro</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 overflow-y-auto">
          {TABS.map((t, i) => (
            <div key={t.id}>
              {t.section && (
                <p className={`text-[10px] font-semibold text-gray-600 uppercase tracking-wider px-3 ${i === 0 ? 'mb-2' : 'mt-5 mb-2'}`}>{t.section}</p>
              )}
              <button onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 cursor-pointer mb-0.5 text-[13px]
                  ${tab === t.id
                    ? 'bg-[#c9a84c]/10 text-[#c9a84c] font-medium'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'}`}>
                <t.icon size={16} strokeWidth={tab === t.id ? 2 : 1.5} />
                <span>{t.label}</span>
              </button>
            </div>
          ))}
        </nav>

        {/* Active session in sidebar */}
        {activeSession && (
          <div className="mx-3 mb-3 p-3 rounded-xl bg-[#c9a84c]/[0.06] border border-[#c9a84c]/10">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] animate-pulse" />
              <span className="text-[#c9a84c] text-[11px] font-medium">Sesión activa</span>
            </div>
            <p className="text-white text-xs font-mono mb-1.5">{activeSession.storyId}</p>
            <div className="flex items-center justify-between">
              <SessionTimer startedAt={activeSession.startedAt} />
              <button onClick={stopSession} className="text-red-400/70 hover:text-red-400 cursor-pointer transition-colors"><Square size={12} /></button>
            </div>
          </div>
        )}

        <div className="p-3 border-t border-[#1a1a1a]">
          <button onClick={() => setShowDevSelector(true)} className="flex items-center gap-3 w-full cursor-pointer hover:opacity-80 transition-opacity px-2 py-2 rounded-lg hover:bg-white/[0.02]">
            {currentDev && (<>
              <div className={`w-8 h-8 rounded-full ${MEMBER_COLORS[currentDev.color]} flex items-center justify-center text-white text-xs font-bold shrink-0`}>{currentDev.avatar}</div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{currentDev.name}</p>
                <p className="text-gray-600 text-[10px]">{currentDev.ai}</p>
              </div>
            </>)}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 ml-[220px] overflow-auto min-h-screen">
        {/* Top bar */}
        <div className="sticky top-0 z-20 bg-[#0c0c0c]/80 backdrop-blur-xl border-b border-[#1a1a1a]">
          <div className="px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-white">{TABS.find(t => t.id === tab)?.label}</h1>
            </div>
            <div className="flex items-center gap-2">
              {activeSession && (
                <div className="flex items-center gap-2 bg-[#c9a84c]/[0.06] px-3 py-1.5 rounded-lg border border-[#c9a84c]/10 mr-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] animate-pulse" />
                  <span className="text-[#c9a84c]/80 text-xs font-mono">{activeSession.storyId}</span>
                  <SessionTimer startedAt={activeSession.startedAt} />
                </div>
              )}
              <div className="relative">
                <button onClick={() => setShowNotifs(!showNotifs)} className="relative p-2.5 text-gray-500 hover:text-gray-300 cursor-pointer rounded-lg hover:bg-white/[0.03] transition-all">
                  <Bell size={18} />
                  {unreadNotifs > 0 && <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-medium">{unreadNotifs}</span>}
                </button>
                {showNotifs && <NotifDropdown notifications={notifications} setNotifications={setNotifications} onClose={() => setShowNotifs(false)} />}
              </div>
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="p-8">
          {tab === 'board' && <BoardView stories={stories} epics={epics} sprints={sprints} getEpic={getEpic} updateStory={updateStory} onSelect={setSelectedStory} logActivity={logActivity} currentDev={currentDev} />}
          {tab === 'backlog' && <BacklogView stories={stories} epics={epics} getEpic={getEpic} onSelect={setSelectedStory} onCreateStory={() => setShowCreateStory(true)} onEditStory={setEditingStory} onDeleteStory={async id => { const u = stories.filter(s => s.id !== id); setStories(u); await saveData('stories', u); await logActivity(`eliminó ${id}`, id); }} />}
          {tab === 'sprints' && <SprintsView stories={stories} sprints={sprints} />}
          {tab === 'roadmap' && <RoadmapView stories={stories} epics={epics} sprints={sprints} />}
          {tab === 'activity' && <ActivityView activities={activities} team={team} />}
          {tab === 'standup' && <StandupView standups={standups} setStandups={setStandups} currentDev={currentDev} />}
          {tab === 'retro' && <RetroView retros={retros} setRetros={setRetros} sprints={sprints} />}
          {tab === 'dod' && <DoDView items={dodItems} setItems={setDodItems} />}
          {tab === 'wiki' && <WikiView entries={wikiEntries} setEntries={setWikiEntries} currentDev={currentDev} />}
          {tab === 'changelog' && <ChangelogView entries={changelogs} setEntries={setChangelogs} currentDev={currentDev} />}
          {tab === 'docs' && <DocsView />}
          {tab === 'metrics' && <MetricsView stories={stories} epics={epics} sessions={sessions} team={team} />}
        </div>
      </main>

      {/* Modals */}
      {selectedStory && <StoryModal story={selectedStory} epic={getEpic(selectedStory.epicId)} epics={epics} sprints={sprints} team={team} stories={stories} onClose={() => setSelectedStory(null)}
        onUpdate={async u => { await updateStory(selectedStory.id, u); if (u.status) await logActivity(`movió ${selectedStory.id} a ${STATUS_CONFIG[u.status].label}`, selectedStory.id); }}
        currentDev={currentDev} activeSession={activeSession} onStartSession={() => startSession(selectedStory.id)} onStopSession={stopSession}
        onAddComment={async text => { if (!currentDev) return; const c: Comment = { id: genId(), devName: currentDev.name, text, timestamp: now() }; await updateStory(selectedStory.id, { comments: [...(selectedStory.comments || []), c] }); await logActivity(`comentó en ${selectedStory.id}`, selectedStory.id); }} />}

      {(showCreateStory || editingStory) && <StoryFormModal story={editingStory} epics={epics} sprints={sprints} stories={stories}
        onClose={() => { setShowCreateStory(false); setEditingStory(null); }}
        onSave={async data => {
          if (editingStory) { await updateStory(editingStory.id, data); await logActivity(`editó ${editingStory.id}`, editingStory.id); }
          else { const ns: UserStory = { ...data, id: `BP-${String(stories.length + 1).padStart(3, '0')}`, createdAt: now(), comments: [], assignee: currentDev?.name } as UserStory; const u = [...stories, ns]; setStories(u); await saveData('stories', u); await logActivity(`creó ${ns.id}`, ns.id); }
          setShowCreateStory(false); setEditingStory(null);
        }} />}
    </div>
  );
}

// ── SMALL COMPONENTS ───────────────────────────────

function SessionTimer({ startedAt }: { startedAt: string }) {
  const [e, setE] = useState('0:00:00');
  useEffect(() => { const i = setInterval(() => { const d = Date.now() - new Date(startedAt).getTime(); setE(`${Math.floor(d/3600000)}:${String(Math.floor((d%3600000)/60000)).padStart(2,'0')}:${String(Math.floor((d%60000)/1000)).padStart(2,'0')}`); }, 1000); return () => clearInterval(i); }, [startedAt]);
  return <span className="text-[#c9a84c] text-xs font-mono">{e}</span>;
}

function Sel({ value, onChange, children, className = '' }: { value: string; onChange: (v: string) => void; children: React.ReactNode; className?: string }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`px-3 py-2 bg-[#141414] border border-[#232323] rounded-lg text-sm text-gray-300 focus:outline-none focus:border-[#c9a84c]/40 cursor-pointer transition-colors ${className}`}>
      {children}
    </select>
  );
}

function NotifDropdown({ notifications, setNotifications, onClose }: { notifications: Notification[]; setNotifications: (n: Notification[]) => void; onClose: () => void }) {
  const markAllRead = () => { const u = notifications.map(n => ({ ...n, read: true })); setNotifications(u); saveData('notifications', u); };
  return (
    <div className="absolute right-0 top-12 w-96 bg-[#141414] border border-[#232323] rounded-xl shadow-2xl shadow-black/40 z-50 overflow-hidden">
      <div className="px-5 py-4 border-b border-[#232323] flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Notificaciones</span>
        <button onClick={markAllRead} className="text-xs text-[#c9a84c] hover:text-[#dbb960] cursor-pointer font-medium">Marcar leídas</button>
      </div>
      <div className="max-h-80 overflow-y-auto divide-y divide-[#232323]">
        {notifications.length === 0 ? <p className="text-gray-500 text-sm p-6 text-center">Sin notificaciones</p> :
        notifications.slice(0, 10).map(n => (
          <div key={n.id} className={`px-5 py-3.5 hover:bg-white/[0.01] transition-colors ${n.read ? 'opacity-40' : ''}`}>
            <div className="flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.type === 'warning' ? 'bg-amber-400' : 'bg-blue-400'}`} />
              <div>
                <p className="text-sm text-gray-300 leading-relaxed">{n.message}</p>
                <p className="text-xs text-gray-600 mt-1">{timeAgo(n.timestamp)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={onClose} className="w-full px-5 py-3 text-xs text-gray-500 hover:text-white hover:bg-white/[0.02] cursor-pointer border-t border-[#232323] transition-colors">Cerrar</button>
    </div>
  );
}

function AddMemberInline({ team, setTeam, onSelect }: { team: TeamMember[]; setTeam: (t: TeamMember[]) => void; onSelect: (m: TeamMember) => void }) {
  const [name, setName] = useState(''); const [ai, setAi] = useState('Claude');
  const colors = ['emerald','blue','purple','amber','red','cyan','pink','orange'];
  const add = async () => { if (!name.trim()) return; const m: TeamMember = { id: name.toLowerCase().replace(/\s/g,'-'), name: name.trim(), avatar: name.trim()[0].toUpperCase(), color: colors[team.length % colors.length], ai, joinedAt: today() }; const u = [...team, m]; setTeam(u); await saveData('team', u); onSelect(m); };
  return (
    <div className="border-t border-[#232323] pt-5 mt-2">
      <p className="text-gray-500 text-xs mb-3 font-medium">Nuevo en el equipo</p>
      <div className="flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} placeholder="Tu nombre"
          className="flex-1 px-3 py-2.5 bg-[#0c0c0c] border border-[#232323] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#c9a84c]/40" />
        <select value={ai} onChange={e => setAi(e.target.value)}
          className="px-2 py-2.5 bg-[#0c0c0c] border border-[#232323] rounded-lg text-sm text-gray-300 cursor-pointer">
          <option>Claude</option><option>Gemini</option><option>GPT</option><option>Copilot</option>
        </select>
        <button onClick={add} className="px-3 py-2.5 bg-[#c9a84c] text-black rounded-lg hover:bg-[#dbb960] cursor-pointer transition-colors font-semibold"><Plus size={16} /></button>
      </div>
    </div>
  );
}

// ── Card wrapper ──

function Card({ children, className = '', padding = true }: { children: React.ReactNode; className?: string; padding?: boolean }) {
  return <div className={`bg-[#141414] rounded-xl border border-[#232323] ${padding ? 'p-6' : ''} ${className}`}>{children}</div>;
}

function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
        {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  );
}

function Btn({ children, onClick, variant = 'primary', className = '' }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'ghost'; className?: string }) {
  const styles = {
    primary: 'bg-[#c9a84c] text-black hover:bg-[#dbb960] shadow-sm shadow-[#c9a84c]/10 font-semibold',
    secondary: 'bg-[#1e1e1e] text-gray-300 hover:text-white hover:bg-[#282828]',
    ghost: 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]',
  };
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all duration-150 ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}

function Input({ value, onChange, placeholder, className = '', ...rest }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; type?: string }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className={`px-4 py-2.5 bg-[#0c0c0c] border border-[#232323] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#c9a84c]/40 transition-colors ${className}`} {...rest} />
  );
}

// ── SVG Mini Chart ──

function MiniDonut({ value, total, size = 60, color = '#c9a84c' }: { value: number; total: number; size?: number; color?: string }) {
  const pct = total > 0 ? value / total : 0;
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#232323" strokeWidth="5" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
        className="transition-all duration-700" />
    </svg>
  );
}

// ── BOARD (Drag & Drop) ────────────────────────────

function BoardView({ stories, epics, sprints, getEpic, updateStory, onSelect, logActivity, currentDev }: {
  stories: UserStory[]; epics: Epic[]; sprints: Sprint[];
  getEpic: (id: string) => Epic | undefined;
  updateStory: (id: string, u: Partial<UserStory>) => Promise<void>;
  onSelect: (s: UserStory) => void;
  logActivity: (a: string, id?: string) => Promise<void>;
  currentDev: TeamMember | null;
}) {
  const [filterEpic, setFilterEpic] = useState('all');
  const [filterSprint, setFilterSprint] = useState('1');
  const [dragId, setDragId] = useState<string | null>(null);

  const columns: { status: Status; label: string }[] = [
    { status: 'sprint_todo', label: 'To Do' },
    { status: 'in_progress', label: 'En Progreso' },
    { status: 'review', label: 'En Review' },
    { status: 'done', label: 'Completado' },
  ];
  const next: Record<Status, Status> = { backlog: 'sprint_todo', sprint_todo: 'in_progress', in_progress: 'review', review: 'done', done: 'done' };

  const filtered = useMemo(() => stories.filter(s => {
    if (s.status === 'backlog') return false;
    if (filterEpic !== 'all' && s.epicId !== filterEpic) return false;
    if (filterSprint !== 'all' && String(s.sprint) !== filterSprint) return false;
    return true;
  }), [stories, filterEpic, filterSprint]);

  const onDragStart = (e: DragEvent, id: string) => { e.dataTransfer.setData('text/plain', id); setDragId(id); };
  const onDragOver = (e: DragEvent) => e.preventDefault();
  const onDrop = async (e: DragEvent, status: Status) => {
    e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); setDragId(null);
    if (!id) return;
    await updateStory(id, { status, assignee: stories.find(s => s.id === id)?.assignee || currentDev?.name });
    await logActivity(`movió ${id} a ${STATUS_CONFIG[status].label}`, id);
  };

  return (
    <div>
      <PageHeader title="Board" subtitle={`${filtered.length} historias en vista`}>
        <Sel value={filterSprint} onChange={setFilterSprint}>
          <option value="all">Todos Sprints</option>
          {sprints.map(s => <option key={s.id} value={s.id}>Sprint {s.id}</option>)}
          <option value="0">Pre-proyecto</option>
        </Sel>
        <Sel value={filterEpic} onChange={setFilterEpic}>
          <option value="all">Todas Épicas</option>
          {epics.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </Sel>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {columns.map(col => {
          const cs = filtered.filter(s => s.status === col.status);
          return (
            <div key={col.status} onDragOver={onDragOver} onDrop={e => onDrop(e, col.status)}
              className={`rounded-xl border transition-all duration-200 ${dragId ? 'border-[#c9a84c]/20 bg-[#c9a84c]/[0.01]' : 'border-[#232323] bg-[#111111]'}`}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#232323]">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[col.status]}`} />
                  <span className="text-sm font-semibold text-gray-300">{col.label}</span>
                </div>
                <span className="text-xs font-medium text-gray-600 bg-[#1e1e1e] px-2 py-0.5 rounded-md">{cs.length}</span>
              </div>
              <div className="p-3 space-y-2.5 min-h-[120px]">
                {cs.map(story => {
                  const epic = getEpic(story.epicId);
                  const isBlocked = (story.blockedBy?.length || 0) > 0;
                  return (
                    <div key={story.id} draggable onDragStart={e => onDragStart(e, story.id)} onClick={() => onSelect(story)}
                      className={`bg-[#141414] rounded-lg border p-4 cursor-grab hover:border-[#333] transition-all duration-150 group active:cursor-grabbing hover:shadow-lg hover:shadow-black/10 ${isBlocked ? 'border-red-500/20' : 'border-[#232323]'}`}>
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 font-mono">{story.id}</span>
                          {isBlocked && <Link2 size={11} className="text-red-400/60" />}
                        </div>
                        <span className="text-[11px] font-mono text-gray-500 bg-[#0c0c0c] px-2 py-0.5 rounded-md">{story.points}pts</span>
                      </div>
                      <p className="text-sm text-gray-200 font-medium mb-3 leading-relaxed">{story.title}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          {epic && <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${EPIC_COLORS[epic.color]}`}>{epic.name.split(' ')[0]}</span>}
                          {story.assignee && <span className="text-[11px] text-gray-500">@{story.assignee}</span>}
                        </div>
                        {story.status !== 'done' && (
                          <button onClick={e => { e.stopPropagation(); updateStory(story.id, { status: next[story.status], assignee: story.assignee || currentDev?.name }); logActivity(`movió ${story.id} a ${STATUS_CONFIG[next[story.status]].label}`, story.id); }}
                            className="opacity-0 group-hover:opacity-100 text-[#c9a84c]/60 hover:text-[#c9a84c] cursor-pointer transition-all"><Zap size={14} /></button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {cs.length === 0 && <div className="text-center py-10 text-gray-700 text-xs">Sin historias</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── BACKLOG ────────────────────────────────────────

function BacklogView({ stories, epics, getEpic, onSelect, onCreateStory, onEditStory, onDeleteStory }: {
  stories: UserStory[]; epics: Epic[]; getEpic: (id: string) => Epic | undefined;
  onSelect: (s: UserStory) => void; onCreateStory: () => void; onEditStory: (s: UserStory) => void; onDeleteStory: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => { if (!search) return stories; const q = search.toLowerCase(); return stories.filter(s => s.title.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || s.tags.some(t => t.includes(q))); }, [stories, search]);
  const sorted = useMemo(() => { const o: Record<Priority,number> = { critical:0, high:1, medium:2, low:3 }; return [...filtered].sort((a,b) => o[a.priority]-o[b.priority]); }, [filtered]);

  return (
    <div>
      <PageHeader title="Backlog" subtitle={`${stories.length} historias totales`}>
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
          <Input value={search} onChange={setSearch} placeholder="Buscar historias..." className="pl-10 w-64" />
        </div>
        <Btn onClick={onCreateStory}><Plus size={15} /> Nueva Historia</Btn>
        <Btn variant="secondary" onClick={() => exportCSV('backlog.csv', ['ID','Título','Épica','Prioridad','Puntos','Estado','Sprint','Asignado'], stories.map(s => [s.id, s.title, getEpic(s.epicId)?.name||'', s.priority, String(s.points), STATUS_CONFIG[s.status].label, s.sprint?`S${s.sprint}`:'-', s.assignee||'-']))}>
          <Download size={15} /> CSV
        </Btn>
      </PageHeader>

      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#232323]">
                {['ID','Título','Épica','Prioridad','Pts','Estado','Sprint','Asignado',''].map(h =>
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232323]/50">
              {sorted.map(story => {
                const epic = getEpic(story.epicId);
                return (
                  <tr key={story.id} onClick={() => onSelect(story)} className="hover:bg-white/[0.01] cursor-pointer transition-colors group">
                    <td className="px-5 py-3.5 text-xs text-gray-500 font-mono">{story.id}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[story.priority]}`} />
                        <span className="text-sm text-white font-medium">{story.title}</span>
                        {(story.blockedBy?.length||0)>0 && <Link2 size={11} className="text-red-400/60" />}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">{epic && <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${EPIC_COLORS[epic.color]}`}>{epic.name}</span>}</td>
                    <td className="px-5 py-3.5"><span className={`text-xs font-medium px-2.5 py-1 rounded-md ring-1 ${PRIORITY_BADGE[story.priority]}`}>{PRIORITY_CONFIG[story.priority].label}</span></td>
                    <td className="px-5 py-3.5 text-center text-xs font-mono text-gray-400">{story.points}</td>
                    <td className="px-5 py-3.5"><span className={`text-xs font-medium px-2.5 py-1 rounded-md ring-1 ${STATUS_BADGE[story.status]}`}>{STATUS_CONFIG[story.status].label}</span></td>
                    <td className="px-5 py-3.5 text-xs text-gray-500">{story.sprint?`Sprint ${story.sprint}`:'-'}</td>
                    <td className="px-5 py-3.5 text-xs text-gray-400">{story.assignee||'-'}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={e => { e.stopPropagation(); onEditStory(story); }} className="p-1.5 text-gray-500 hover:text-white cursor-pointer rounded hover:bg-white/[0.05]"><Edit3 size={13} /></button>
                        <button onClick={e => { e.stopPropagation(); if(confirm(`¿Eliminar ${story.id}?`)) onDeleteStory(story.id); }} className="p-1.5 text-gray-500 hover:text-red-400 cursor-pointer rounded hover:bg-white/[0.05]"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── SPRINTS + BURNDOWN ─────────────────────────────

function SprintsView({ stories, sprints }: { stories: UserStory[]; sprints: Sprint[] }) {
  return (
    <div>
      <PageHeader title="Sprint Planning" subtitle="Gestión y seguimiento de sprints" />
      <div className="space-y-8">
        {sprints.map(sprint => {
          const ss = stories.filter(s => s.sprint === sprint.id);
          const totalPts = ss.reduce((a,s) => a+s.points, 0);
          const donePts = ss.filter(s => s.status==='done').reduce((a,s) => a+s.points, 0);
          const pct = totalPts > 0 ? (donePts/totalPts)*100 : 0;
          const days = differenceInDays(new Date(sprint.endDate), new Date(sprint.startDate)) + 1;
          const elapsed = Math.max(0, differenceInDays(new Date(), new Date(sprint.startDate)));

          return (
            <Card key={sprint.id} padding={false}>
              <div className="p-6 pb-5">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-white">{sprint.name}</h3>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-md ring-1 ${sprint.status === 'active' ? 'bg-[#c9a84c]/10 text-[#c9a84c] ring-[#c9a84c]/20' : 'bg-gray-500/10 text-gray-400 ring-gray-500/20'}`}>
                        {sprint.status === 'active' ? 'Activo' : 'Planificación'}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm mb-1">{sprint.goal}</p>
                    <p className="text-gray-600 text-xs">{sprint.startDate} → {sprint.endDate}</p>
                  </div>
                  <div className="flex gap-8 items-center">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-white">{ss.length}</p>
                      <p className="text-xs text-gray-500 mt-1">Historias</p>
                    </div>
                    <div className="relative">
                      <MiniDonut value={donePts} total={totalPts} size={64} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">{Math.round(pct)}%</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-[#c9a84c]">{donePts}<span className="text-lg text-gray-600">/{totalPts}</span></p>
                      <p className="text-xs text-gray-500 mt-1">Puntos</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="w-full h-2 bg-[#0c0c0c] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#8a7332] to-[#c9a84c] rounded-full transition-all duration-500" style={{width:`${pct}%`}} />
                  </div>
                </div>

                {sprint.status === 'active' && totalPts > 0 && (
                  <div className="mt-6 pt-5 border-t border-[#232323]">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Burndown Chart</h4>
                    <div className="w-full aspect-[4/1] relative">
                      <svg viewBox={`0 0 ${days * 40 + 40} 120`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                        {[0, 25, 50, 75, 100].map(p => (
                          <g key={p}>
                            <line x1="30" y1={10 + (100-p)} x2={days*40+30} y2={10 + (100-p)} stroke="#232323" strokeWidth="0.5" />
                            <text x="24" y={14 + (100-p)} fill="#4a4d5e" fontSize="7" textAnchor="end">{Math.round(totalPts * p / 100)}</text>
                          </g>
                        ))}
                        <line x1="30" y1="10" x2={days*40+30} y2="110" stroke="#3b3f54" strokeWidth="1.5" strokeDasharray="4,4" />
                        {elapsed > 0 && (() => {
                          const points: string[] = [`30,10`];
                          for (let i = 1; i <= Math.min(elapsed, days); i++) {
                            const remaining = totalPts - donePts * (i / elapsed);
                            const y = 10 + ((remaining / totalPts) * 100);
                            points.push(`${i*40+30},${Math.max(10, Math.min(110, y))}`);
                          }
                          return <polyline points={points.join(' ')} fill="none" stroke="#c9a84c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
                        })()}
                        {Array.from({ length: days }, (_, i) => (
                          <text key={i} x={i*40+30} y="118" fill="#4a4d5e" fontSize="7" textAnchor="middle">
                            {format(addDays(new Date(sprint.startDate), i), 'dd')}
                          </text>
                        ))}
                      </svg>
                      <div className="absolute bottom-0 left-0 flex gap-6 pl-10">
                        <div className="flex items-center gap-2"><div className="w-4 h-0.5 bg-[#3b3f54]" style={{backgroundImage:'repeating-linear-gradient(90deg, #3b3f54 0 4px, transparent 4px 8px)'}} /><span className="text-[10px] text-gray-500">Ideal</span></div>
                        <div className="flex items-center gap-2"><div className="w-4 h-0.5 bg-[#c9a84c] rounded" /><span className="text-[10px] text-gray-500">Real</span></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-[#232323]">
                {ss.map(story => (
                  <div key={story.id} className="px-6 py-3 flex items-center justify-between hover:bg-white/[0.01] transition-colors border-b border-[#232323]/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${PRIORITY_DOT[story.priority]}`} />
                      <span className="text-xs text-gray-500 font-mono">{story.id}</span>
                      <span className="text-sm text-gray-300">{story.title}</span>
                      {story.assignee && <span className="text-xs text-gray-600">@{story.assignee}</span>}
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-md ring-1 ${STATUS_BADGE[story.status]}`}>{STATUS_CONFIG[story.status].label}</span>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── ROADMAP ────────────────────────────────────────

function RoadmapView({ stories, epics, sprints }: { stories: UserStory[]; epics: Epic[]; sprints: Sprint[] }) {
  const totalCols = sprints.length + 1;
  return (
    <div>
      <PageHeader title="Roadmap" subtitle="Vista general del progreso por épicas y sprints" />
      <Card padding={false}>
        <div className="flex border-b border-[#232323]">
          <div className="w-44 shrink-0 px-5 py-4 border-r border-[#232323]">
            <span className="text-xs font-semibold text-gray-500 uppercase">Épica</span>
          </div>
          <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${totalCols}, 1fr)` }}>
            {sprints.map(s => (
              <div key={s.id} className="px-4 py-4 text-center border-r border-[#232323] last:border-0">
                <p className="text-xs text-gray-300 font-semibold">{s.name.split(' - ')[1] || s.name}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">{s.startDate} → {s.endDate}</p>
              </div>
            ))}
            <div className="px-4 py-4 text-center">
              <p className="text-xs text-gray-400 font-semibold">Futuro</p>
              <p className="text-[10px] text-gray-600 mt-0.5">Sin planificar</p>
            </div>
          </div>
        </div>

        {epics.map(epic => {
          const es = stories.filter(s => s.epicId === epic.id);
          const done = es.filter(s => s.status === 'done').length;
          const sprintRange = es.filter(s => s.sprint).map(s => s.sprint!);
          const minS = sprintRange.length ? Math.min(...sprintRange) : 0;
          const maxS = sprintRange.length ? Math.max(...sprintRange) : 0;
          const start = minS > 0 ? minS - 1 : totalCols - 1;
          const span = maxS > 0 ? maxS - minS + 1 : 1;
          const pct = es.length > 0 ? Math.round((done/es.length)*100) : 0;

          return (
            <div key={epic.id} className="flex border-b border-[#232323] last:border-0 hover:bg-white/[0.01] transition-colors">
              <div className="w-44 shrink-0 px-5 py-4 border-r border-[#232323] flex items-center">
                <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${EPIC_COLORS[epic.color]}`}>{epic.name}</span>
              </div>
              <div className="flex-1 grid py-3 px-2" style={{ gridTemplateColumns: `repeat(${totalCols}, 1fr)` }}>
                {Array.from({ length: totalCols }, (_, i) => (
                  <div key={i} className="px-1 flex items-center">
                    {i >= start && i < start + span ? (
                      <div className="w-full h-8 rounded-lg bg-[#c9a84c]/10 border border-[#c9a84c]/20 flex items-center justify-center gap-2">
                        <span className="text-[11px] text-[#c9a84c] font-medium">{done}/{es.length}</span>
                        <span className="text-[10px] text-gray-500">{pct}%</span>
                      </div>
                    ) : (
                      <div className="w-full h-8 rounded-lg bg-[#0c0c0c]/50" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ── ACTIVITY ───────────────────────────────────────

function ActivityView({ activities, team }: { activities: Activity[]; team: TeamMember[] }) {
  const [filterDev, setFilterDev] = useState('all');
  const filtered = filterDev === 'all' ? activities : activities.filter(a => a.devName === filterDev);
  const sorted = [...filtered].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return (
    <div>
      <PageHeader title="Actividad" subtitle="Historial de acciones del equipo">
        <Sel value={filterDev} onChange={setFilterDev}>
          <option value="all">Todos los devs</option>
          {team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
        </Sel>
      </PageHeader>

      {sorted.length === 0 && <Card><p className="text-gray-500 text-sm text-center py-8">Sin actividad registrada</p></Card>}

      <div className="space-y-3">
        {sorted.slice(0, 50).map(a => {
          const m = team.find(t => t.name === a.devName);
          return (
            <Card key={a.id} className="flex items-start gap-4">
              <div className={`w-9 h-9 rounded-full ${MEMBER_COLORS[m?.color||'gray']||'bg-gray-600'} flex items-center justify-center text-white text-xs font-bold shrink-0`}>{m?.avatar||'?'}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-300"><strong className="text-white font-medium">{a.devName}</strong> {a.action}</p>
                <p className="text-xs text-gray-600 mt-1">{timeAgo(a.timestamp)}</p>
              </div>
              {a.storyId && <span className="text-xs font-mono text-gray-500 bg-[#0c0c0c] px-2.5 py-1 rounded-md shrink-0">{a.storyId}</span>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── STANDUP ─────────────────────────────────────────

function StandupView({ standups, setStandups, currentDev }: { standups: StandupEntry[]; setStandups: (s: StandupEntry[]) => void; currentDev: TeamMember | null }) {
  const [date, setDate] = useState(today());
  const [y, setY] = useState(''); const [t, setT] = useState(''); const [b, setB] = useState('');
  const ds = standups.filter(s => s.date === date);
  const submit = async () => {
    if (!currentDev || !y.trim() || !t.trim()) return;
    const e: StandupEntry = { id: genId(), devName: currentDev.name, date, yesterday: y.trim(), today: t.trim(), blockers: b.trim() };
    const u = [...standups, e]; setStandups(u); await saveData('standups', u); setY(''); setT(''); setB('');
  };

  return (
    <div>
      <PageHeader title="Daily Standup" subtitle="Comparte tu progreso con el equipo">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="px-4 py-2.5 bg-[#141414] border border-[#232323] rounded-lg text-sm text-white focus:outline-none cursor-pointer" />
      </PageHeader>

      <Card className="mb-8">
        <h3 className="text-sm font-semibold text-white mb-5">Tu standup, {currentDev?.name}</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">¿Qué hiciste ayer?</label>
            <textarea value={y} onChange={e => setY(e.target.value)} rows={2} placeholder="Describe tu trabajo de ayer..."
              className="w-full px-4 py-3 bg-[#0c0c0c] border border-[#232323] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#c9a84c]/40 resize-none transition-colors" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">¿Qué harás hoy?</label>
            <textarea value={t} onChange={e => setT(e.target.value)} rows={2} placeholder="Planes para hoy..."
              className="w-full px-4 py-3 bg-[#0c0c0c] border border-[#232323] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#c9a84c]/40 resize-none transition-colors" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">¿Bloqueos?</label>
            <textarea value={b} onChange={e => setB(e.target.value)} rows={1} placeholder="¿Algo te bloquea?"
              className="w-full px-4 py-3 bg-[#0c0c0c] border border-[#232323] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#c9a84c]/40 resize-none transition-colors" />
          </div>
          <Btn onClick={submit}><Send size={15} /> Enviar Standup</Btn>
        </div>
      </Card>

      {ds.length === 0 && <p className="text-gray-600 text-sm text-center py-6">Sin standups para {date}</p>}

      <div className="space-y-4">
        {ds.map(s => (
          <Card key={s.id}>
            <p className="text-white font-semibold text-sm mb-4">{s.devName}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Ayer</p>
                <p className="text-sm text-gray-300 leading-relaxed">{s.yesterday}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Hoy</p>
                <p className="text-sm text-gray-300 leading-relaxed">{s.today}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Bloqueos</p>
                <p className={`text-sm leading-relaxed ${s.blockers ? 'text-red-400' : 'text-gray-600'}`}>{s.blockers || 'Ninguno'}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── RETRO ──────────────────────────────────────────

function RetroView({ retros, setRetros, sprints }: { retros: RetroEntry[]; setRetros: (r: RetroEntry[]) => void; sprints: Sprint[] }) {
  const [sprintId, setSprintId] = useState(sprints[0]?.id || 1);
  const [w, setW] = useState(''); const [im, setIm] = useState(''); const [ac, setAc] = useState('');
  const retro = retros.find(r => r.sprintId === sprintId);
  const addItem = async (type: 'wentWell'|'toImprove'|'actions', text: string) => {
    if (!text.trim()) return; let u: RetroEntry[];
    if (retro) { u = retros.map(r => r.id === retro.id ? { ...r, [type]: [...r[type], text.trim()] } : r); }
    else { const n: RetroEntry = { id: genId(), sprintId, date: today(), wentWell: [], toImprove: [], actions: [] }; n[type] = [text.trim()]; u = [...retros, n]; }
    setRetros(u); await saveData('retros', u);
    if (type==='wentWell') setW(''); if (type==='toImprove') setIm(''); if (type==='actions') setAc('');
  };

  const cols: { key: 'wentWell'|'toImprove'|'actions'; title: string; dotColor: string; v: string; set: (s: string) => void; items: string[] }[] = [
    { key: 'wentWell', title: '¿Qué salió bien?', dotColor: 'bg-emerald-400', v: w, set: setW, items: retro?.wentWell||[] },
    { key: 'toImprove', title: '¿Qué mejorar?', dotColor: 'bg-amber-400', v: im, set: setIm, items: retro?.toImprove||[] },
    { key: 'actions', title: 'Acciones', dotColor: 'bg-blue-400', v: ac, set: setAc, items: retro?.actions||[] },
  ];

  return (
    <div>
      <PageHeader title="Retrospectiva" subtitle="Reflexión del equipo por sprint">
        <Sel value={String(sprintId)} onChange={v => setSprintId(Number(v))}>
          {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Sel>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cols.map(col => (
          <Card key={col.key}>
            <div className="flex items-center gap-2 mb-5">
              <div className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
              <h3 className="text-sm font-semibold text-white">{col.title}</h3>
            </div>
            <div className="flex gap-2 mb-5">
              <Input value={col.v} onChange={col.set} placeholder="Agregar..." className="flex-1" />
              <button onClick={() => addItem(col.key, col.v)} className="p-2.5 bg-[#0c0c0c] text-gray-400 rounded-lg hover:text-white cursor-pointer transition-colors border border-[#232323]"><Plus size={15} /></button>
            </div>
            <ul className="space-y-2.5">
              {col.items.map((item,i) => (
                <li key={i} className="text-sm text-gray-300 flex items-start gap-3 leading-relaxed">
                  <div className={`w-1.5 h-1.5 rounded-full ${col.dotColor} mt-2 shrink-0`} />
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── DEFINITION OF DONE ─────────────────────────────

function DoDView({ items, setItems }: { items: DoDItem[]; setItems: (i: DoDItem[]) => void }) {
  const [newItem, setNewItem] = useState('');
  const toggle = async (id: string) => { const u = items.map(i => i.id === id ? { ...i, checked: !i.checked } : i); setItems(u); await saveData('dod', u); };
  const add = async () => { if (!newItem.trim()) return; const u = [...items, { id: genId(), text: newItem.trim(), checked: false }]; setItems(u); await saveData('dod', u); setNewItem(''); };
  const remove = async (id: string) => { const u = items.filter(i => i.id !== id); setItems(u); await saveData('dod', u); };
  const checked = items.filter(i => i.checked).length;

  return (
    <div>
      <PageHeader title="Definition of Done" subtitle="Checklist que toda historia debe cumplir antes de considerarse terminada" />
      <div className="max-w-2xl">
        <Card className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">{checked} de {items.length} completados</span>
            <span className="text-sm font-semibold text-[#c9a84c]">{items.length > 0 ? Math.round((checked/items.length)*100) : 0}%</span>
          </div>
          <div className="w-full h-2 bg-[#0c0c0c] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#8a7332] to-[#c9a84c] rounded-full transition-all duration-300" style={{width:`${items.length > 0 ? (checked/items.length)*100 : 0}%`}} />
          </div>
        </Card>

        <Card>
          <div className="space-y-1 mb-6">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-4 group py-3 px-2 rounded-lg hover:bg-white/[0.01] transition-colors -mx-2">
                <button onClick={() => toggle(item.id)}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 cursor-pointer transition-all ${item.checked ? 'bg-[#c9a84c] border-[#c9a84c] text-black' : 'border-[#333] hover:border-gray-400'}`}>
                  {item.checked && <Check size={12} strokeWidth={3} />}
                </button>
                <span className={`text-sm flex-1 ${item.checked ? 'text-gray-600 line-through' : 'text-gray-200'}`}>{item.text}</span>
                <button onClick={() => remove(item.id)} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 cursor-pointer transition-all p-1"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-3 border-t border-[#232323] pt-5">
            <Input value={newItem} onChange={setNewItem} placeholder="Nuevo criterio..." className="flex-1" />
            <Btn onClick={add}><Plus size={15} /> Agregar</Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── WIKI ───────────────────────────────────────────

function WikiView({ entries, setEntries, currentDev }: { entries: WikiEntry[]; setEntries: (e: WikiEntry[]) => void; currentDev: TeamMember | null }) {
  const [editing, setEditing] = useState<WikiEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState(''); const [content, setContent] = useState('');
  const [viewing, setViewing] = useState<WikiEntry | null>(null);

  const save = async () => {
    if (!title.trim() || !content.trim()) return;
    if (editing) { const u = entries.map(e => e.id === editing.id ? { ...e, title: title.trim(), content: content.trim(), updatedAt: now() } : e); setEntries(u); await saveData('wiki', u); }
    else { const n: WikiEntry = { id: genId(), title: title.trim(), content: content.trim(), author: currentDev?.name || 'Anónimo', updatedAt: now() }; const u = [...entries, n]; setEntries(u); await saveData('wiki', u); }
    setEditing(null); setCreating(false); setTitle(''); setContent('');
  };
  const remove = async (id: string) => { const u = entries.filter(e => e.id !== id); setEntries(u); await saveData('wiki', u); };

  if (viewing) return (
    <div>
      <button onClick={() => setViewing(null)} className="text-gray-500 hover:text-white text-sm mb-6 cursor-pointer flex items-center gap-1 transition-colors">
        <ChevronRight size={14} className="rotate-180" /> Volver al Wiki
      </button>
      <h2 className="text-2xl font-bold text-white mb-2">{viewing.title}</h2>
      <p className="text-gray-500 text-sm mb-6">Por {viewing.author} · {timeAgo(viewing.updatedAt)}</p>
      <Card><p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{viewing.content}</p></Card>
    </div>
  );

  if (creating || editing) return (
    <div>
      <PageHeader title={editing ? 'Editar Artículo' : 'Nuevo Artículo'} />
      <div className="max-w-2xl space-y-4">
        <Input value={title} onChange={setTitle} placeholder="Título del artículo" className="w-full text-base" />
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={14} placeholder="Escribe el contenido aquí..."
          className="w-full px-4 py-3 bg-[#0c0c0c] border border-[#232323] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#c9a84c]/40 resize-none transition-colors leading-relaxed" />
        <div className="flex gap-3">
          <Btn onClick={save}><Check size={15} /> Guardar</Btn>
          <Btn variant="secondary" onClick={() => { setCreating(false); setEditing(null); setTitle(''); setContent(''); }}>Cancelar</Btn>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Wiki" subtitle="Base de conocimiento del equipo">
        <Btn onClick={() => setCreating(true)}><Plus size={15} /> Nuevo Artículo</Btn>
      </PageHeader>

      {entries.length === 0 && <Card><p className="text-gray-500 text-sm text-center py-8">No hay artículos. Crea el primero.</p></Card>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {entries.map(e => (
          <Card key={e.id} className="hover:border-[#333] transition-all duration-200 group">
            <div className="flex items-start justify-between mb-3">
              <h3 onClick={() => setViewing(e)} className="text-white font-semibold text-sm cursor-pointer hover:text-[#c9a84c] transition-colors leading-relaxed">{e.title}</h3>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditing(e); setTitle(e.title); setContent(e.content); }} className="p-1.5 text-gray-500 hover:text-white cursor-pointer rounded hover:bg-white/[0.05]"><Edit3 size={13} /></button>
                <button onClick={() => { if(confirm('¿Eliminar?')) remove(e.id); }} className="p-1.5 text-gray-500 hover:text-red-400 cursor-pointer rounded hover:bg-white/[0.05]"><Trash2 size={13} /></button>
              </div>
            </div>
            <p className="text-gray-500 text-xs line-clamp-3 mb-4 leading-relaxed">{e.content}</p>
            <p className="text-gray-600 text-xs">{e.author} · {timeAgo(e.updatedAt)}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── CHANGELOG ──────────────────────────────────────

function ChangelogView({ entries, setEntries, currentDev }: { entries: ChangelogEntry[]; setEntries: (e: ChangelogEntry[]) => void; currentDev: TeamMember | null }) {
  const [adding, setAdding] = useState(false);
  const [version, setVersion] = useState(''); const [changes, setChanges] = useState('');

  const save = async () => {
    if (!version.trim() || !changes.trim()) return;
    const n: ChangelogEntry = { id: genId(), version: version.trim(), date: today(), changes: changes.split('\n').map(l => l.trim()).filter(Boolean), author: currentDev?.name || 'Anónimo' };
    const u = [n, ...entries]; setEntries(u); await saveData('changelog', u); setAdding(false); setVersion(''); setChanges('');
  };

  return (
    <div>
      <PageHeader title="Changelog" subtitle="Historial de versiones y cambios">
        <Btn onClick={() => setAdding(true)}><Plus size={15} /> Nueva Versión</Btn>
      </PageHeader>

      {adding && (
        <Card className="mb-8 max-w-xl">
          <h3 className="text-sm font-semibold text-white mb-4">Nueva versión</h3>
          <div className="space-y-4">
            <Input value={version} onChange={setVersion} placeholder="Versión (ej: 0.2.0)" className="w-full" />
            <textarea value={changes} onChange={e => setChanges(e.target.value)} rows={5} placeholder="Cambios (uno por línea)"
              className="w-full px-4 py-3 bg-[#0c0c0c] border border-[#232323] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#c9a84c]/40 resize-none transition-colors" />
            <div className="flex gap-3">
              <Btn onClick={save}><Check size={15} /> Guardar</Btn>
              <Btn variant="secondary" onClick={() => setAdding(false)}>Cancelar</Btn>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-5 max-w-2xl">
        {entries.map(e => (
          <Card key={e.id}>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#c9a84c]/10 border border-[#c9a84c]/20 flex items-center justify-center">
                <GitBranch size={18} className="text-[#c9a84c]" />
              </div>
              <div>
                <span className="text-white font-bold text-lg">v{e.version}</span>
                <p className="text-gray-500 text-xs mt-0.5">{e.date} · por {e.author}</p>
              </div>
            </div>
            <ul className="space-y-2.5 pl-1">
              {e.changes.map((c,i) => (
                <li key={i} className="text-sm text-gray-300 flex items-start gap-3 leading-relaxed">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] mt-2 shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── DOCS ───────────────────────────────────────────

function DocsView() {
  return (
    <div>
      <PageHeader title="Documentación" subtitle="Archivos del proyecto en /docs" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {DOCS.map(doc => (
          <Card key={doc.file} className="hover:border-[#333] transition-all duration-200 group">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-[#c9a84c]/10 border border-[#c9a84c]/20 flex items-center justify-center shrink-0">
                <FileText size={18} className="text-[#c9a84c]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold text-sm mb-1.5 group-hover:text-[#c9a84c] transition-colors">{doc.title}</h3>
                <p className="text-gray-500 text-xs mb-3 leading-relaxed">{doc.desc}</p>
                <code className="text-xs text-gray-600 bg-[#0c0c0c] px-2.5 py-1 rounded-md font-mono">docs/{doc.file}</code>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── METRICS ────────────────────────────────────────

function MetricsView({ stories, epics, sessions, team }: { stories: UserStory[]; epics: Epic[]; sessions: Session[]; team: TeamMember[] }) {
  const byStatus = useMemo(() => { const c: Record<string,number> = {}; Object.keys(STATUS_CONFIG).forEach(k => c[k]=0); stories.forEach(s => c[s.status]++); return c; }, [stories]);
  const totalPts = stories.reduce((a,s) => a+s.points, 0);
  const donePts = stories.filter(s => s.status==='done').reduce((a,s) => a+s.points, 0);
  const hoursByDev = useMemo(() => { const h: Record<string,number> = {}; sessions.filter(s => s.hours).forEach(s => { h[s.devName]=(h[s.devName]||0)+(s.hours||0); }); return h; }, [sessions]);
  const storiesByDev = useMemo(() => { const c: Record<string,number> = {}; stories.filter(s => s.status==='done'&&s.assignee).forEach(s => { c[s.assignee!]=(c[s.assignee!]||0)+1; }); return c; }, [stories]);
  const maxHours = Math.max(...Object.values(hoursByDev), 1);

  const kpis: { label: string; value: number | string; sub?: string; color: string }[] = [
    { label: 'Total Historias', value: stories.length, color: 'text-white' },
    { label: 'Completadas', value: byStatus.done||0, sub: `${totalPts > 0 ? Math.round(((byStatus.done||0)/stories.length)*100) : 0}%`, color: 'text-[#c9a84c]' },
    { label: 'En Progreso', value: (byStatus.in_progress||0)+(byStatus.review||0), color: 'text-amber-400' },
    { label: 'Pendientes', value: (byStatus.backlog||0)+(byStatus.sprint_todo||0), color: 'text-blue-400' },
  ];

  return (
    <div>
      <PageHeader title="Métricas" subtitle="Vista general del rendimiento del equipo">
        <Btn variant="secondary" onClick={() => exportCSV('metricas.csv', ['Dev','Horas','Historias Completadas'], team.map(m => [m.name, String(hoursByDev[m.name]||0), String(storiesByDev[m.name]||0)]))}>
          <Download size={15} /> Exportar CSV
        </Btn>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {kpis.map(k => (
          <Card key={k.label}>
            <p className="text-xs font-medium text-gray-500 mb-3">{k.label}</p>
            <div className="flex items-end gap-2">
              <p className={`text-4xl font-bold ${k.color}`}>{k.value}</p>
              {k.sub && <span className="text-sm text-gray-500 mb-1">{k.sub}</span>}
            </div>
          </Card>
        ))}
      </div>

      <Card className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-5">
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">Story Points Completados</h3>
            <p className="text-xs text-gray-500">{donePts} de {totalPts} puntos completados</p>
          </div>
          <div className="relative">
            <MiniDonut value={donePts} total={totalPts} size={80} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-white">{totalPts > 0 ? Math.round((donePts/totalPts)*100) : 0}%</span>
            </div>
          </div>
        </div>
        <div className="w-full h-3 bg-[#0c0c0c] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#8a7332] to-[#c9a84c] rounded-full transition-all duration-500" style={{width:`${totalPts>0?(donePts/totalPts)*100:0}%`}} />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-sm font-semibold text-white mb-6">Horas por Dev</h3>
          {Object.keys(hoursByDev).length === 0 && <p className="text-gray-600 text-sm py-4">Sin sesiones registradas</p>}
          <div className="space-y-5">
            {Object.entries(hoursByDev).map(([dev, hours]) => {
              const m = team.find(t => t.name === dev);
              return (
                <div key={dev}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-full ${MEMBER_COLORS[m?.color||'gray']} flex items-center justify-center text-white text-xs font-bold`}>{m?.avatar||'?'}</div>
                    <span className="text-sm text-gray-300 flex-1">{dev}</span>
                    <span className="text-sm text-white font-semibold">{hours.toFixed(1)}h</span>
                  </div>
                  <div className="ml-11 h-2 bg-[#0c0c0c] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-500" style={{width:`${(hours/maxHours)*100}%`}} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-white mb-6">Progreso por Épica</h3>
          <div className="space-y-4">
            {epics.map(epic => {
              const es = stories.filter(s => s.epicId === epic.id);
              const done = es.filter(s => s.status === 'done').length;
              const pct = es.length > 0 ? (done/es.length)*100 : 0;
              return (
                <div key={epic.id}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-md border ${EPIC_COLORS[epic.color]}`}>{epic.name}</span>
                    <span className="text-xs text-gray-500">{done}/{es.length} <span className="text-gray-600">({Math.round(pct)}%)</span></span>
                  </div>
                  <div className="w-full h-2 bg-[#0c0c0c] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#8a7332] to-[#c9a84c] rounded-full transition-all duration-500" style={{width:`${pct}%`}} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-white mb-6">Distribución por Estado</h3>
          <div className="flex items-end gap-6 h-48 px-4">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const count = byStatus[key] || 0;
              const pct = stories.length > 0 ? (count / stories.length) * 100 : 0;
              return (
                <div key={key} className="flex-1 flex flex-col items-center gap-3">
                  <span className="text-lg font-bold text-white">{count}</span>
                  <div className="w-full bg-[#0c0c0c] rounded-lg overflow-hidden relative" style={{height: '120px'}}>
                    <div className={`absolute bottom-0 w-full rounded-lg transition-all duration-500 ${STATUS_DOT[key as Status]}`}
                      style={{height: `${Math.max(pct, 4)}%`, opacity: 0.6}} />
                  </div>
                  <span className="text-xs text-gray-500 text-center">{cfg.label}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── STORY MODAL ────────────────────────────────────

function StoryModal({ story, epic, epics, sprints, team, stories, onClose, onUpdate, currentDev, activeSession, onStartSession, onStopSession, onAddComment }: {
  story: UserStory; epic?: Epic; epics: Epic[]; sprints: Sprint[]; team: TeamMember[]; stories: UserStory[];
  onClose: () => void; onUpdate: (u: Partial<UserStory>) => void; currentDev: TeamMember | null;
  activeSession: Session | null; onStartSession: () => void; onStopSession: () => void; onAddComment: (t: string) => void;
}) {
  const [comment, setComment] = useState('');
  const [depInput, setDepInput] = useState('');
  const isSessionOnThis = activeSession?.storyId === story.id;

  const addDep = () => { if (!depInput.trim()) return; const deps = [...(story.blockedBy||[]), depInput.trim().toUpperCase()]; onUpdate({ blockedBy: deps }); setDepInput(''); };
  const removeDep = (dep: string) => { onUpdate({ blockedBy: (story.blockedBy||[]).filter(d => d !== dep) }); };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-[5vh] overflow-y-auto" onClick={onClose}>
      <div className="bg-[#141414] rounded-2xl border border-[#232323] w-full max-w-2xl shadow-2xl shadow-black/40 my-4" onClick={e => e.stopPropagation()}>
        <div className="px-7 py-5 border-b border-[#232323] flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3 flex-wrap">
              <span className="text-xs text-gray-500 font-mono bg-[#0c0c0c] px-2.5 py-1 rounded-md">{story.id}</span>
              {epic && <span className={`text-xs px-2.5 py-1 rounded-md font-medium border ${EPIC_COLORS[epic.color]}`}>{epic.name}</span>}
              <span className={`text-xs font-medium px-2.5 py-1 rounded-md ring-1 ${PRIORITY_BADGE[story.priority]}`}>{PRIORITY_CONFIG[story.priority].label}</span>
              {story.assignee && <span className="text-xs text-gray-400 bg-[#0c0c0c] px-2 py-1 rounded-md">@{story.assignee}</span>}
            </div>
            <h2 className="text-xl font-bold text-white leading-relaxed">{story.title}</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white cursor-pointer p-2 rounded-lg hover:bg-white/[0.03] transition-all"><X size={20} /></button>
        </div>

        <div className="px-7 py-6 space-y-6">
          <p className="text-sm text-gray-400 leading-relaxed">{story.description}</p>

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Criterios de Aceptación</h3>
            <div className="space-y-2.5">
              {story.acceptanceCriteria.map((ac,i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`w-4 h-4 rounded-md border mt-0.5 flex items-center justify-center shrink-0 ${story.status==='done' ? 'bg-[#c9a84c] border-[#c9a84c] text-black' : 'border-[#333]'}`}>
                    {story.status==='done' && <Check size={10} strokeWidth={3} />}
                  </div>
                  <span className="text-sm text-gray-300 leading-relaxed">{ac}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-2">Estado</label>
              <select value={story.status} onChange={e => onUpdate({status:e.target.value as Status})}
                className="w-full px-3 py-2.5 bg-[#0c0c0c] border border-[#232323] rounded-lg text-sm text-white cursor-pointer focus:outline-none focus:border-[#c9a84c]/40">
                {Object.entries(STATUS_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-2">Sprint</label>
              <select value={story.sprint??''} onChange={e => onUpdate({sprint:e.target.value?Number(e.target.value):undefined})}
                className="w-full px-3 py-2.5 bg-[#0c0c0c] border border-[#232323] rounded-lg text-sm text-white cursor-pointer focus:outline-none focus:border-[#c9a84c]/40">
                <option value="">Sin asignar</option>{sprints.map(s => <option key={s.id} value={s.id}>Sprint {s.id}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-2">Asignado</label>
              <select value={story.assignee||''} onChange={e => onUpdate({assignee:e.target.value||undefined})}
                className="w-full px-3 py-2.5 bg-[#0c0c0c] border border-[#232323] rounded-lg text-sm text-white cursor-pointer focus:outline-none focus:border-[#c9a84c]/40">
                <option value="">Sin asignar</option>{team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-[#232323]">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Link2 size={13} /> Dependencias</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {(story.blockedBy||[]).map(dep => (
                <span key={dep} className="text-xs px-3 py-1 rounded-md bg-red-500/10 text-red-400 ring-1 ring-red-500/20 flex items-center gap-2">
                  {dep} <button onClick={() => removeDep(dep)} className="hover:text-white cursor-pointer"><X size={11} /></button>
                </span>
              ))}
              {(story.blockedBy||[]).length === 0 && <span className="text-xs text-gray-600">Sin dependencias</span>}
            </div>
            <div className="flex gap-2">
              <Input value={depInput} onChange={setDepInput} placeholder="BP-XXX" className="w-32" />
              <Btn variant="secondary" onClick={addDep}>Agregar</Btn>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4 border-t border-[#232323] flex-wrap">
            {isSessionOnThis ? (
              <Btn variant="ghost" onClick={onStopSession} className="text-red-400 hover:text-red-300 hover:bg-red-500/5"><Square size={14} /> Detener Sesión</Btn>
            ) : (
              <Btn variant={activeSession ? 'ghost' : 'secondary'} onClick={activeSession ? undefined : onStartSession} className={activeSession ? 'opacity-30 cursor-not-allowed' : ''}>
                <Play size={14} /> Iniciar Sesión
              </Btn>
            )}
            <div className="flex items-center gap-2"><Zap size={14} className="text-gray-500" /><span className="text-sm text-gray-400">{story.points} pts</span></div>
            <div className="flex gap-1.5 flex-wrap">
              {story.tags.map(t => <span key={t} className="text-xs px-2 py-1 rounded-md bg-[#0c0c0c] text-gray-500 border border-[#232323]">{t}</span>)}
            </div>
          </div>

          <div className="pt-4 border-t border-[#232323]">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2"><MessageSquare size={13} /> Comentarios ({(story.comments||[]).length})</h3>
            <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
              {(story.comments||[]).map(c => (
                <div key={c.id} className="bg-[#0c0c0c] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-white">{c.devName}</span>
                    <span className="text-xs text-gray-600">{timeAgo(c.timestamp)}</span>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{c.text}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Input value={comment} onChange={setComment} placeholder={`Comentar como ${currentDev?.name||''}...`} className="flex-1" />
              <Btn onClick={() => { if(comment.trim()) { onAddComment(comment.trim()); setComment(''); }}}><Send size={14} /></Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── STORY FORM MODAL ───────────────────────────────

function StoryFormModal({ story, epics, sprints, stories, onClose, onSave }: {
  story: UserStory | null; epics: Epic[]; sprints: Sprint[]; stories: UserStory[];
  onClose: () => void; onSave: (data: Partial<UserStory>) => void;
}) {
  const [title, setTitle] = useState(story?.title||'');
  const [description, setDescription] = useState(story?.description||'');
  const [epicId, setEpicId] = useState(story?.epicId||epics[0]?.id||'');
  const [priority, setPriority] = useState<Priority>(story?.priority||'medium');
  const [points, setPoints] = useState(story?.points||3);
  const [type, setType] = useState<StoryType>(story?.type||'feature');
  const [status, setStatus] = useState<Status>(story?.status||'backlog');
  const [sprint, setSprint] = useState(story?.sprint?String(story.sprint):'');
  const [tagsStr, setTagsStr] = useState((story?.tags||[]).join(', '));
  const [acStr, setAcStr] = useState((story?.acceptanceCriteria||[]).join('\n'));

  const save = () => { if (!title.trim()) return; onSave({ title:title.trim(), description:description.trim(), epicId, priority, points, type, status, sprint:sprint?Number(sprint):undefined, tags:tagsStr.split(',').map(t => t.trim()).filter(Boolean), acceptanceCriteria:acStr.split('\n').map(l => l.trim()).filter(Boolean) }); };

  const selectCls = "w-full px-3 py-2.5 bg-[#0c0c0c] border border-[#232323] rounded-lg text-sm text-white cursor-pointer focus:outline-none focus:border-[#c9a84c]/40";

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-[5vh] overflow-y-auto" onClick={onClose}>
      <div className="bg-[#141414] rounded-2xl border border-[#232323] w-full max-w-lg shadow-2xl shadow-black/40 my-4" onClick={e => e.stopPropagation()}>
        <div className="px-7 py-5 border-b border-[#232323] flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{story ? `Editar ${story.id}` : 'Nueva Historia'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white cursor-pointer p-2 rounded-lg hover:bg-white/[0.03]"><X size={20} /></button>
        </div>
        <div className="px-7 py-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-2">Título *</label>
            <Input value={title} onChange={setTitle} className="w-full" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-2">Descripción</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className="w-full px-4 py-3 bg-[#0c0c0c] border border-[#232323] rounded-lg text-sm text-white focus:outline-none focus:border-[#c9a84c]/40 resize-none transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs font-medium text-gray-500 block mb-2">Épica</label><select value={epicId} onChange={e => setEpicId(e.target.value)} className={selectCls}>{epics.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
            <div><label className="text-xs font-medium text-gray-500 block mb-2">Prioridad</label><select value={priority} onChange={e => setPriority(e.target.value as Priority)} className={selectCls}>{Object.entries(PRIORITY_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
            <div><label className="text-xs font-medium text-gray-500 block mb-2">Points</label><select value={points} onChange={e => setPoints(Number(e.target.value))} className={selectCls}>{[1,2,3,5,8,13,21].map(p => <option key={p} value={p}>{p}</option>)}</select></div>
            <div><label className="text-xs font-medium text-gray-500 block mb-2">Tipo</label><select value={type} onChange={e => setType(e.target.value as StoryType)} className={selectCls}><option value="feature">Feature</option><option value="bug">Bug</option><option value="tech_debt">Tech Debt</option><option value="spike">Spike</option></select></div>
            <div><label className="text-xs font-medium text-gray-500 block mb-2">Estado</label><select value={status} onChange={e => setStatus(e.target.value as Status)} className={selectCls}>{Object.entries(STATUS_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
            <div><label className="text-xs font-medium text-gray-500 block mb-2">Sprint</label><select value={sprint} onChange={e => setSprint(e.target.value)} className={selectCls}><option value="">Sin asignar</option>{sprints.map(s => <option key={s.id} value={s.id}>Sprint {s.id}</option>)}</select></div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-2">Tags (separados por coma)</label>
            <Input value={tagsStr} onChange={setTagsStr} className="w-full" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-2">Criterios de Aceptación (uno por línea)</label>
            <textarea value={acStr} onChange={e => setAcStr(e.target.value)} rows={3}
              className="w-full px-4 py-3 bg-[#0c0c0c] border border-[#232323] rounded-lg text-sm text-white focus:outline-none focus:border-[#c9a84c]/40 resize-none transition-colors" />
          </div>
          <Btn onClick={save} className="w-full justify-center py-3">{story ? 'Guardar Cambios' : 'Crear Historia'}</Btn>
        </div>
      </div>
    </div>
  );
}
