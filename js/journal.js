// ============================================================
// journal.js — Workout Session Engine
// Контракт з бекендом (буде реалізовано на наступному кроці):
//   GET  /api/session/current        → { session: {...} | null }
//   POST /api/session/start          → { session_id, day_label, exercises: [...] }
//   POST /api/session/log_set        → { is_pr: bool, exercise: str, delta: number|null }
//   POST /api/session/finish         → { duration_sec, total_volume, prs: [...] }
//   GET  /api/journal (вже існує)    → { journal: [...] }
// ============================================================

import { apiFetch } from './auth.js';

// Стан поточної сесії тримаємо в пам'яті модуля (не в localStorage —
// у Mini App заборонено, і не треба: /api/session/current відновлює
// стан з сервера при кожному відкритті).
let session = null;   // { session_id, day_label, exercises }
let exIdx = 0;
let setIdx = 0;
let totalSets = 0;
let totalVolume = 0;
let restTimerInterval = null;
let collectedPRs = [];
const startedAt = () => session?.started_at_client || Date.now();

const screen = () => document.getElementById('screen-journal');

async function loadJournalScreen() {
  screen().innerHTML = `<div class="loading">Завантаження…</div>`;

  const current = await apiFetch('/api/session/current');

  if (current.session) {
    // Є незавершена сесія — відновлюємо тренування з того місця
    session = current.session;
    exIdx = current.session.current_exercise_idx || 0;
    setIdx = current.session.current_set_idx || 0;
    totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);
    totalVolume = current.session.volume_so_far || 0;
    renderSessionUI();
    renderExercise();
  } else {
    await renderIdleScreen();
  }
}

// ── Екран "нема активного тренування" ──
async function renderIdleScreen() {
  const journalData = await apiFetch('/api/journal');
  const entries = journalData.journal || [];

  const historyHtml = entries.length
    ? entries.slice(0, 10).map(entryToHtml).join('')
    : `<div class="card" style="text-align:center;color:#6B6B78;">Ще немає записаних тренувань</div>`;

  screen().innerHTML = `
    <h1 class="title" style="font-size:26px;margin-bottom:14px;">Журнал</h1>
    <div class="card" style="text-align:center;">
      <div style="font-size:14px;color:#8B8B98;margin-bottom:12px;">Готовий до тренування?</div>
      <button class="btn-primary" id="startWorkoutBtn">▶️ Почати тренування</button>
    </div>
    <h2 style="font-size:16px;color:#8B8B98;margin:18px 0 10px;font-family:'DM Sans';font-weight:700;">Історія</h2>
    ${historyHtml}
  `;

  document.getElementById('startWorkoutBtn').addEventListener('click', startWorkout);
}

function entryToHtml(entry) {
  const setsCount = entry.sets.length;
  const uniqueExercises = new Set(entry.sets.map(s => s.exercise)).size;
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;">
        <span style="font-weight:700;">${entry.date}</span>
        <span style="color:#6B6B78;font-size:13px;">${uniqueExercises} вправ · ${setsCount} підходів</span>
      </div>
    </div>
  `;
}

// ── Старт тренування ──
async function startWorkout() {
  screen().innerHTML = `<div class="loading">Готуємо тренування…</div>`;
  session = await apiFetch('/api/session/start', { method: 'POST' });
  exIdx = 0;
  setIdx = 0;
  totalVolume = 0;
  collectedPRs = [];
  totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);

  renderSessionUI();
  renderExercise();
}

// ── Розмітка самого сеансу (прогрес-бар + картка вправи + таймер відпочинку) ──
function renderSessionUI() {
  screen().innerHTML = `
    <div class="session-topbar">
      <div class="session-topbar-row">
        <div class="title" style="font-size:22px;">${session.day_label}</div>
        <div class="exit-link" id="exitBtn">Вийти</div>
      </div>
      <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>
      <div class="progress-meta">
        <span id="progressPct"></span>
        <span id="progressVolume"></span>
      </div>
    </div>

    <div class="view active" id="exerciseView"></div>
    <div class="view rest-view" id="restView"></div>
    <div class="view finish-view" id="finishView"></div>
  `;

  document.getElementById('exitBtn').addEventListener('click', () => {
    if (confirm('Вийти з тренування? Прогрес збережено, зможеш продовжити пізніше.')) {
      loadJournalScreen();
    }
  });
}

function updateProgress() {
  let done = 0;
  for (let i = 0; i < exIdx; i++) done += session.exercises[i].sets.length;
  done += setIdx;
  const pct = Math.round((done / totalSets) * 100);
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressPct').textContent = `Підхід ${done + 1} з ${totalSets}`;
  document.getElementById('progressVolume').textContent = `Обсяг: ${totalVolume} кг`;
}

// ── Картка поточної вправи ──
function renderExercise() {
  const ex = session.exercises[exIdx];
  const set = ex.sets[setIdx];

  const doneSetsHtml = ex.sets.slice(0, setIdx).map((s, i) => `
    <div class="done-set-item">
      <span class="num">Підхід ${i + 1}</span>
      <span class="val">✓ ${s.weight} × ${s.reps}</span>
    </div>
  `).join('');

  document.getElementById('exerciseView').innerHTML = `
    <div class="ex-card">
      <div class="ex-name">${ex.name}</div>
      <div class="ex-sub">${ex.type} · Підхід ${setIdx + 1} з ${ex.sets.length}</div>

      <div class="done-sets">${doneSetsHtml}</div>

      <div class="set-row">
        <div class="set-label">
          <span>Факт</span>
          <span class="set-plan">План: ${set.weight} × ${set.reps}</span>
        </div>
        <div class="inputs-row">
          <div class="input-group">
            <label>Вага (кг)</label>
            <input type="number" id="weightInput" inputmode="decimal" value="${set.weight}">
          </div>
          <div class="input-group">
            <label>Повторення</label>
            <input type="number" id="repsInput" inputmode="numeric" value="${set.reps}">
          </div>
        </div>
        <button class="btn-primary" id="saveSetBtn">✓ Зберегти підхід</button>
      </div>

      <div class="prev-note">Минулого разу: <b>${ex.prev || '—'}</b></div>
    </div>
  `;

  document.getElementById('saveSetBtn').addEventListener('click', saveSet);
  updateProgress();
}

// ── Збереження підходу ──
async function saveSet() {
  const weight = parseFloat(document.getElementById('weightInput').value) || 0;
  const reps = parseInt(document.getElementById('repsInput').value) || 0;
  const ex = session.exercises[exIdx];

  const result = await apiFetch('/api/session/log_set', {
    method: 'POST',
    body: JSON.stringify({
      session_id: session.session_id,
      exercise_idx: exIdx,
      set_idx: setIdx,
      weight,
      reps,
    }),
  });

  totalVolume += weight * reps;
  if (result.is_pr) {
    collectedPRs.push({ exercise: ex.name, delta: result.delta });
  }

  const isLastSetOfEx = setIdx === ex.sets.length - 1;
  const isLastEx = exIdx === session.exercises.length - 1;

  if (isLastSetOfEx && isLastEx) {
    await finishWorkout();
    return;
  }

  const nextLabel = isLastSetOfEx
    ? `${session.exercises[exIdx + 1].name} · Підхід 1`
    : `${ex.name} · Підхід ${setIdx + 2}`;
  showRest(ex.rest || 90, nextLabel);
}

// ── Таймер відпочинку ──
function showRest(seconds, nextLabel) {
  document.getElementById('exerciseView').classList.remove('active');
  const restView = document.getElementById('restView');
  restView.classList.add('active');

  const circumference = 478;
  restView.innerHTML = `
    <div class="rest-label">Відпочинок</div>
    <div class="rest-ring">
      <svg width="170" height="170">
        <circle cx="85" cy="85" r="76" stroke="#1A1A24" stroke-width="8" fill="none"/>
        <circle cx="85" cy="85" r="76" stroke="#F5C842" stroke-width="8" fill="none"
          stroke-dasharray="${circumference}" stroke-dashoffset="0" id="restCircle" stroke-linecap="round"/>
      </svg>
      <div class="rest-time" id="restTime">${formatTime(seconds)}</div>
    </div>
    <div class="rest-next">Далі: <b>${nextLabel}</b></div>
    <button class="skip-btn" id="skipRestBtn">Пропустити →</button>
  `;
  document.getElementById('skipRestBtn').addEventListener('click', skipRest);

  let remaining = seconds;
  const circle = document.getElementById('restCircle');
  clearInterval(restTimerInterval);
  restTimerInterval = setInterval(() => {
    remaining--;
    document.getElementById('restTime').textContent = formatTime(remaining);
    circle.style.strokeDashoffset = circumference * (1 - remaining / seconds);
    if (remaining <= 0) {
      clearInterval(restTimerInterval);
      advanceToNext();
    }
  }, 1000);
}

function skipRest() {
  clearInterval(restTimerInterval);
  advanceToNext();
}

function advanceToNext() {
  document.getElementById('restView').classList.remove('active');
  document.getElementById('exerciseView').classList.add('active');

  const ex = session.exercises[exIdx];
  if (setIdx < ex.sets.length - 1) {
    setIdx++;
  } else {
    exIdx++;
    setIdx = 0;
  }
  renderExercise();
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ── Завершення тренування ──
async function finishWorkout() {
  const result = await apiFetch('/api/session/finish', {
    method: 'POST',
    body: JSON.stringify({ session_id: session.session_id }),
  });

  document.getElementById('exerciseView').classList.remove('active');
  document.getElementById('restView').classList.remove('active');
  document.querySelector('.session-topbar')?.remove();

  const finishView = document.getElementById('finishView');
  finishView.classList.add('active');

  const prsHtml = (result.prs || []).map(pr => `
    <div class="pr-box">
      <div>
        <div class="pr-label">🏅 Новий рекорд</div>
        <div class="pr-ex">${pr.exercise}</div>
      </div>
      <div class="pr-delta">+${pr.delta} кг</div>
    </div>
  `).join('') || '';

  finishView.innerHTML = `
    <div class="trophy">🏆</div>
    <div class="finish-title">Тренування завершене</div>
    <div class="finish-time">${formatDuration(result.duration_sec)}</div>
    <div class="finish-stats">
      <div class="stat-box">
        <div class="label">Обсяг</div>
        <div class="value">${result.total_volume.toLocaleString()} кг</div>
      </div>
      <div class="stat-box">
        <div class="label">Вправ</div>
        <div class="value">${session.exercises.length}</div>
      </div>
    </div>
    ${prsHtml}
    <button class="btn-primary" id="closeSessionBtn">Готово</button>
  `;

  document.getElementById('closeSessionBtn').addEventListener('click', () => {
    session = null;
    loadJournalScreen();
  });
}

function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
}

export { loadJournalScreen };
