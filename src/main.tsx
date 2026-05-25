import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { getRouter } from './router'
import './styles.css'
import {
  getTeams, saveTeams,
  getMatches, saveMatches,
  getTrainingSessions, saveTrainingSessions,
  getAttendance, saveAttendance,
  getEvaluations, saveEvaluations,
} from './lib/storage'
import { initSync } from './lib/sync'

const router = getRouter()

// ── Sync au démarrage ─────────────────────────────────────────────────────────
// Lance la sync en background SANS bloquer le rendu de l'UI
initSync(
  {
    teams: getTeams(),
    matches: getMatches(),
    sessions: getTrainingSessions(),
    attendance: getAttendance(),
    evaluations: getEvaluations(),
  },
  (cloudData) => {
    // Le cloud a des données → on met à jour localStorage silencieusement
    // sans déclencher de re-push (on écrit directement dans localStorage)
    localStorage.setItem('bball_teams', JSON.stringify(cloudData.teams));
    localStorage.setItem('bball_matches', JSON.stringify(cloudData.matches));
    localStorage.setItem('bball_sessions', JSON.stringify(cloudData.sessions));
    localStorage.setItem('bball_attendance', JSON.stringify(cloudData.attendance));
    localStorage.setItem('bball_evaluations', JSON.stringify(cloudData.evaluations));
  }
).catch(() => {
  // Erreur réseau → on continue en local, aucune interruption
});

const rootEl = document.getElementById('root')!
createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
