import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { getMatches, getTrainingSessions, getTeams } from "@/lib/storage";
import type { Match, TrainingSession, Team } from "@/types/basketball";
import { getTeamScore } from "@/types/basketball";

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
});

interface CalendarEvent {
  id: string;
  date: Date;
  type: 'match' | 'training';
  title: string;
  subtitle: string;
  matchId?: string;
  sessionId?: string;
  status?: string;
  score?: string;
}

const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre'
];

function CalendarPage() {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());

  useEffect(() => {
    const allTeams = getTeams();
    setTeams(allTeams);

    const matchEvents: CalendarEvent[] = getMatches().map(m => {
      const idA = m.teamAId || 'A';
      const idB = m.teamBId || 'B';
      const sA = getTeamScore(m.events, idA);
      const sB = getTeamScore(m.events, idB);
      return {
        id: m.id,
        date: new Date(m.createdAt),
        type: 'match',
        title: `${m.teamAName} vs ${m.teamBName}`,
        subtitle: m.status === 'finished' ? `${sA} – ${sB}` : 'En cours',
        matchId: m.id,
        status: m.status,
        score: m.status === 'finished' ? `${sA} – ${sB}` : undefined,
      };
    });

    const sessionEvents: CalendarEvent[] = getTrainingSessions().map(s => {
      const team = allTeams.find(t => t.id === s.teamId);
      return {
        id: s.id,
        date: new Date(s.date),
        type: 'training',
        title: team ? `Entraînement — ${team.name}` : 'Entraînement',
        subtitle: s.notes?.slice(0, 40) || '',
        sessionId: s.id,
        status: 'finished',
      };
    });

    setEvents([...matchEvents, ...sessionEvents].sort((a, b) => b.date.getTime() - a.date.getTime()));
  }, []);

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Jours du mois
  const firstDay  = new Date(year, month, 1);
  const lastDay   = new Date(year, month + 1, 0);
  const startDow  = (firstDay.getDay() + 6) % 7; // 0=lun
  const daysCount = lastDay.getDate();

  // Map jour → events ce mois
  const eventsByDay = useMemo(() => {
    const map: Record<number, CalendarEvent[]> = {};
    events.forEach(ev => {
      if (ev.date.getFullYear() === year && ev.date.getMonth() === month) {
        const d = ev.date.getDate();
        if (!map[d]) map[d] = [];
        map[d].push(ev);
      }
    });
    return map;
  }, [events, year, month]);

  // Events du jour sélectionné
  const dayEvents = selectedDay ? (eventsByDay[selectedDay] || []) : [];

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday   = () => {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDay(today.getDate());
  };

  // Construire la grille
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysCount; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  return (
    <div className="min-h-screen bg-background">
      <header className="px-5 pt-8 pb-4 flex items-center gap-3">
        <Link to="/"><Button variant="ghost" size="icon">←</Button></Link>
        <h1 className="text-xl font-bold text-foreground flex-1">📅 Calendrier</h1>
        <button
          type="button"
          onClick={goToday}
          className="text-xs text-primary font-semibold px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors"
        >
          Aujourd'hui
        </button>
      </header>

      {/* Navigation mois */}
      <div className="px-5 flex items-center justify-between mb-4">
        <button type="button" onClick={prevMonth} className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center text-foreground hover:bg-secondary/80 transition-colors active:scale-95">
          ‹
        </button>
        <h2 className="text-base font-bold text-foreground">
          {MONTHS[month]} {year}
        </h2>
        <button type="button" onClick={nextMonth} className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center text-foreground hover:bg-secondary/80 transition-colors active:scale-95">
          ›
        </button>
      </div>

      {/* Grille calendrier */}
      <div className="px-5 mb-4">
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          {/* Headers jours */}
          <div className="grid grid-cols-7 border-b border-border">
            {DAYS_SHORT.map(d => (
              <div key={d} className="py-2 text-center text-[10px] font-bold text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          {/* Cellules */}
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              if (!day) return (
                <div key={`empty-${idx}`} className="aspect-square border-b border-r border-border/30 last:border-r-0" />
              );
              const dayEvs = eventsByDay[day] || [];
              const hasMatch    = dayEvs.some(e => e.type === 'match');
              const hasTraining = dayEvs.some(e => e.type === 'training');
              const isSelected  = selectedDay === day;
              const isTod       = isToday(day);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`aspect-square border-b border-r border-border/30 last:border-r-0 flex flex-col items-center justify-start pt-1 gap-0.5 transition-colors ${
                    isSelected ? 'bg-primary/20' : isTod ? 'bg-primary/8' : 'hover:bg-secondary/60'
                  }`}
                >
                  <span className={`text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                    isTod ? 'bg-primary text-primary-foreground' : isSelected ? 'text-primary' : 'text-foreground'
                  }`}>
                    {day}
                  </span>
                  <div className="flex gap-0.5">
                    {hasMatch    && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                    {hasTraining && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Légende */}
        <div className="flex gap-4 mt-2 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[10px] text-muted-foreground">Match</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-[10px] text-muted-foreground">Entraînement</span>
          </div>
        </div>
      </div>

      {/* Events du jour sélectionné */}
      <div className="px-5 pb-8">
        {selectedDay ? (
          <>
            <h3 className="text-sm font-bold text-foreground mb-3">
              {selectedDay} {MONTHS[month]} {year}
              {dayEvents.length === 0 && <span className="text-muted-foreground font-normal ml-2 text-xs">— Aucun événement</span>}
            </h3>
            <div className="space-y-2">
              {dayEvents.map(ev => (
                <EventCard key={ev.id} event={ev} />
              ))}
            </div>
          </>
        ) : (
          /* Vue mensuelle : tous les events du mois */
          <>
            <h3 className="text-sm font-bold text-foreground mb-3">
              Tous les événements — {MONTHS[month]}
              {Object.values(eventsByDay).flat().length === 0 && (
                <span className="text-muted-foreground font-normal ml-2 text-xs">Aucun</span>
              )}
            </h3>
            <div className="space-y-2">
              {Array.from({ length: daysCount }, (_, i) => i + 1)
                .filter(d => eventsByDay[d]?.length > 0)
                .flatMap(d => eventsByDay[d].map(ev => (
                  <EventCard key={ev.id} event={ev} dayLabel={`${d} ${MONTHS[month]}`} />
                )))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EventCard({ event, dayLabel }: { event: CalendarEvent; dayLabel?: string }) {
  const isMatch = event.type === 'match';
  const time = event.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <Link
      to={isMatch ? '/report/$matchId' : '/training/$sessionId'}
      params={isMatch
        ? { matchId: event.matchId! }
        : { sessionId: event.sessionId! }
      }
    >
      <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors hover:border-primary/40 active:scale-[0.99] ${
        isMatch ? 'bg-card border-border' : 'bg-amber-500/5 border-amber-400/20'
      }`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
          isMatch ? 'bg-primary/15' : 'bg-amber-400/15'
        }`}>
          {isMatch ? '🏀' : '🏋️'}
        </div>
        <div className="flex-1 min-w-0">
          {dayLabel && <p className="text-[10px] text-muted-foreground mb-0.5">{dayLabel}</p>}
          <p className="text-sm font-semibold text-foreground truncate">{event.title}</p>
          {event.subtitle && (
            <p className="text-xs text-muted-foreground truncate">{event.subtitle}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          {event.score ? (
            <p className="text-sm font-black text-primary tabular-nums">{event.score}</p>
          ) : event.status === 'live' ? (
            <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full animate-pulse">LIVE</span>
          ) : null}
          <span className="text-[10px] text-muted-foreground">→</span>
        </div>
      </div>
    </Link>
  );
}
