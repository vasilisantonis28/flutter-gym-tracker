// ==========================================
// 1. DATA MODELS (OOP Structure)
// ==========================================
class Exercise {
  constructor(name, sets, setReps = null, setWeights = null, setCompleted = null) {
    this.name = name;
    this.sets = Math.max(1, Number(sets) || 1);

    // Initialize per-set reps array (default empty string for unlogged sets)
    if (Array.isArray(setReps) && setReps.length === this.sets) {
      this.setReps = setReps.map(r => (r === '' || r === null || r === undefined) ? '' : Number(r));
    } else {
      this.setReps = Array(this.sets).fill('');
    }

    // Initialize per-set weights array (default empty string for unlogged sets)
    if (Array.isArray(setWeights) && setWeights.length === this.sets) {
      this.setWeights = setWeights.map(w => (w === '' || w === null || w === undefined) ? '' : Number(w));
    } else {
      this.setWeights = Array(this.sets).fill('');
    }

    // Auto-complete set if weight > 0
    if (Array.isArray(setCompleted) && setCompleted.length === this.sets) {
      this.setCompleted = setCompleted.map(Boolean);
    } else {
      this.setCompleted = this.setWeights.map(w => Number(w) > 0);
    }
  }

  getCompletedCount() {
    return this.setCompleted.filter(Boolean).length;
  }

  getVolume() {
    return this.setCompleted.reduce((total, isDone, idx) => {
      if (!isDone) return total;
      const r = Number(this.setReps[idx]) || 0;
      const w = Number(this.setWeights[idx]) || 0;
      return total + (r * w);
    }, 0);
  }

  toMap() {
    return {
      name: this.name,
      sets: this.sets,
      setReps: this.setReps,
      setWeights: this.setWeights,
      setCompleted: this.setCompleted
    };
  }

  static fromMap(map) {
    const setsCount = Math.max(1, Number(map.sets) || 1);
    const legacyReps = map.reps !== undefined ? Number(map.reps) : '';
    const legacyWeight = map.weight !== undefined ? Number(map.weight) : '';

    const repsArr = Array.isArray(map.setReps) && map.setReps.length === setsCount
      ? map.setReps
      : Array(setsCount).fill(legacyReps);

    const weightsArr = Array.isArray(map.setWeights) && map.setWeights.length === setsCount
      ? map.setWeights
      : Array(setsCount).fill(legacyWeight);

    let completedArr;
    if (Array.isArray(map.setCompleted) && map.setCompleted.length === setsCount) {
      completedArr = map.setCompleted;
    } else {
      completedArr = weightsArr.map(w => Number(w) > 0);
    }

    return new Exercise(
      map.name,
      setsCount,
      repsArr,
      weightsArr,
      completedArr
    );
  }
}

class Workout {
  constructor(id, title, date, exercises = []) {
    this.id = id;
    this.title = title;
    this.date = date;
    this.exercises = exercises;
  }

  getTotalVolume() {
    return this.exercises.reduce((acc, ex) => acc + ex.getVolume(), 0);
  }

  toMap() {
    return {
      id: this.id,
      title: this.title,
      date: this.date,
      exercises: this.exercises.map(ex => ex.toMap())
    };
  }

  static fromMap(map) {
    const exercises = (map.exercises || []).map(ex => Exercise.fromMap(ex));
    return new Workout(map.id, map.title, map.date, exercises);
  }
}

class Routine {
  constructor(id, title, exercises = []) {
    this.id = id;
    this.title = title;
    this.exercises = exercises;
  }

  toMap() {
    return {
      id: this.id,
      title: this.title,
      exercises: this.exercises.map(ex => ex.toMap())
    };
  }

  static fromMap(map) {
    const exercises = (map.exercises || []).map(ex => Exercise.fromMap(ex));
    return new Routine(map.id, map.title, exercises);
  }
}

// ==========================================
// 2. STATE & STORAGE MANAGEMENT
// ==========================================
const HISTORY_STORAGE_KEY = 'ironlog_history_v4';
const ROUTINES_STORAGE_KEY = 'ironlog_routines_v4';
const CYCLE_INDEX_KEY = 'ironlog_cycle_idx_v4';

let historyLog = [];
let routines = [];
let cycleIndex = 0;

let activeView = 'home';
let activeWorkoutState = null;

const nowInit = new Date();
let calYear = nowInit.getFullYear();
let calMonth = nowInit.getMonth();
let selectedDateKey = formatDateKey(nowInit);

const monthsList = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const weekdaysList = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadData() {
  const rawHist = localStorage.getItem(HISTORY_STORAGE_KEY);
  if (rawHist) {
    try {
      historyLog = JSON.parse(rawHist).map(item => Workout.fromMap(item));
    } catch (e) { historyLog = []; }
  }

  const rawRout = localStorage.getItem(ROUTINES_STORAGE_KEY);
  if (rawRout) {
    try {
      routines = JSON.parse(rawRout).map(item => Routine.fromMap(item));
    } catch (e) { routines = []; }
  } else {
    routines = [
      new Routine('r-1', 'Push Day', [
        new Exercise('Bench Press', 4),
        new Exercise('Shoulder Press', 3)
      ]),
      new Routine('r-2', 'Pull Day', [
        new Exercise('Pull-ups', 4),
        new Exercise('Barbell Curls', 3)
      ]),
      new Routine('r-3', 'Leg Day', [
        new Exercise('Squats', 4),
        new Exercise('Leg Press', 3)
      ])
    ];
    saveRoutines();
  }

  const savedIdx = parseInt(localStorage.getItem(CYCLE_INDEX_KEY), 10);
  if (!isNaN(savedIdx) && savedIdx >= 0) {
    cycleIndex = savedIdx;
  } else {
    cycleIndex = 0;
  }
  validateCycleIndex();
}

function saveHistory() {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyLog.map(w => w.toMap())));
}

function saveRoutines() {
  localStorage.setItem(ROUTINES_STORAGE_KEY, JSON.stringify(routines.map(r => r.toMap())));
}

function setCycleIndex(newIdx) {
  cycleIndex = newIdx;
  validateCycleIndex();
  localStorage.setItem(CYCLE_INDEX_KEY, cycleIndex);
}

function validateCycleIndex() {
  if (routines.length === 0 || cycleIndex >= routines.length) {
    cycleIndex = 0;
  }
}

function advanceCycle() {
  if (routines.length > 0) {
    setCycleIndex((cycleIndex + 1) % routines.length);
  }
}

// ==========================================
// 3. VIEW NAVIGATION
// ==========================================
function switchView(view) {
  activeView = view;
  const views = {
    home: document.getElementById('viewHome'),
    routines: document.getElementById('viewRoutines'),
    month: document.getElementById('viewMonth')
  };
  const btns = {
    home: document.getElementById('tabBtnHome'),
    routines: document.getElementById('tabBtnRoutines'),
    month: document.getElementById('tabBtnMonth')
  };

  Object.keys(views).forEach(k => {
    if (k === view) {
      views[k].classList.remove('hidden');
      btns[k].className = 'flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl text-cyan-500 transition';
    } else {
      views[k].classList.add('hidden');
      btns[k].className = 'flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl text-gray-500 transition hover:text-gray-300';
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderAll();
}

// ==========================================
// 4. UI RENDERERS
// ==========================================

// --- VIEW 1: HOME ---
function startWorkout() {
  const routine = routines[cycleIndex];
  if (!routine) return;
  activeWorkoutState = new Workout(
    'w-' + Date.now(),
    routine.title,
    formatDateKey(new Date()),
    routine.exercises.map(ex => new Exercise(
      ex.name,
      ex.sets,
      Array(ex.sets).fill(''),
      Array(ex.sets).fill(''),
      Array(ex.sets).fill(false)
    ))
  );
  renderHomeView();
}

function skipWorkout() {
  activeWorkoutState = null;
  advanceCycle();
  renderHomeView();
}

function completeWorkout() {
  if (!activeWorkoutState) return;
  historyLog.unshift(activeWorkoutState);
  saveHistory();
  activeWorkoutState = null;
  advanceCycle();
  renderAll();
  switchView('month');
}

function handleSetInput(exerciseIndex, setIndex, field, rawValue) {
  if (!activeWorkoutState || !activeWorkoutState.exercises[exerciseIndex]) return;
  const ex = activeWorkoutState.exercises[exerciseIndex];

  if (field === 'reps') {
    ex.setReps[setIndex] = rawValue === '' ? '' : (parseInt(rawValue, 10) || 0);
  } else if (field === 'weight') {
    ex.setWeights[setIndex] = rawValue === '' ? '' : parseFloat(rawValue);
  }

  // Auto-mark as Done as soon as weight is entered (> 0)
  const weightVal = parseFloat(ex.setWeights[setIndex]);
  const isDone = !isNaN(weightVal) && weightVal > 0;
  ex.setCompleted[setIndex] = isDone;

  // Update row styling dynamically without re-rendering DOM (preserves input focus)
  const rowEl = document.getElementById(`set-row-${exerciseIndex}-${setIndex}`);
  const lblEl = document.getElementById(`set-lbl-${exerciseIndex}-${setIndex}`);
  const statusEl = document.getElementById(`set-status-${exerciseIndex}-${setIndex}`);

  if (rowEl && lblEl && statusEl) {
    rowEl.className = `flex items-center justify-between gap-2 py-2 px-3 rounded-xl bg-navy-900 border transition-colors ${
      isDone ? 'border-cyan-500/60 bg-cyan-500/5' : 'border-navy-700'
    }`;
    lblEl.className = `text-xs font-extrabold w-12 ${isDone ? 'text-cyan-400' : 'text-gray-400'}`;
    statusEl.className = `w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black transition-all shrink-0 ${
      isDone ? 'bg-cyan-500 text-navy-900 shadow-sm shadow-cyan-500/30' : 'bg-navy-800 text-gray-600 border border-navy-700'
    }`;
    statusEl.textContent = isDone ? '✓' : '•';
  }
}

function renderHomeView() {
  const container = document.getElementById('homeStateContainer');

  if (routines.length === 0) {
    container.innerHTML = `
      <div class="glass-card rounded-2xl p-8 text-center bg-navy-800 border border-navy-700 shadow-sm mt-10">
        <div class="w-11 h-11 rounded-2xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-2.5">
          <i data-lucide="layout-template" class="w-5 h-5 text-cyan-500"></i>
        </div>
        <h3 class="text-sm font-bold text-white">Cycle Empty</h3>
        <p class="text-xs text-gray-400 mt-1">Go to Routines to build your workout cycle.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  if (!activeWorkoutState) {
    const nextRoutine = routines[cycleIndex];
    container.innerHTML = `
      <div class="glass-card rounded-2xl p-5 bg-navy-800 border border-navy-700 shadow-sm space-y-4 mt-8">
        <div class="text-center mt-2 mb-1">
          <h2 class="text-2xl font-black text-white mt-1">${nextRoutine.title}</h2>
          <p class="text-xs font-semibold text-gray-400 mt-1">${nextRoutine.exercises.length} exercises</p>
        </div>
        
        <div class="space-y-1.5 bg-navy-900 p-3 rounded-xl border border-navy-700">
          ${nextRoutine.exercises.map(ex => `
            <div class="flex justify-between text-xs text-gray-300 border-b border-navy-700 pb-1.5 last:border-0 last:pb-0">
              <span class="font-semibold truncate pr-2">${ex.name}</span>
              <span class="shrink-0 text-cyan-400 font-bold">${ex.sets} sets</span>
            </div>
          `).join('')}
        </div>

        <div class="grid grid-cols-3 gap-2 mt-2">
          <button onclick="skipWorkout()" class="col-span-1 py-3 rounded-xl text-xs font-bold text-gray-300 bg-navy-700 hover:bg-navy-600 border border-navy-600 transition-colors">
            Skip
          </button>
          <button onclick="startWorkout()" class="col-span-2 py-3 rounded-xl text-sm font-black bg-cyan-500 text-navy-900 shadow-md shadow-cyan-500/20 hover:bg-cyan-400 transition-colors">
            Start Workout
          </button>
        </div>
      </div>
    `;
  } else {
    const exercisesHtml = activeWorkoutState.exercises.map((ex, idx) => {
      let setRowsHtml = '';
      for (let s = 0; s < ex.sets; s++) {
        const isDone = ex.setCompleted[s];
        const currentReps = ex.setReps[s] !== undefined ? ex.setReps[s] : '';
        const currentWeight = ex.setWeights[s] !== undefined ? ex.setWeights[s] : '';

        setRowsHtml += `
          <div id="set-row-${idx}-${s}" class="flex items-center justify-between gap-2 py-2 px-3 rounded-xl bg-navy-900 border transition-colors ${isDone ? 'border-cyan-500/60 bg-cyan-500/5' : 'border-navy-700'}">
            <span id="set-lbl-${idx}-${s}" class="text-xs font-extrabold w-12 ${isDone ? 'text-cyan-400' : 'text-gray-400'}">Set ${s + 1}</span>
            
            <div class="flex items-center gap-2 flex-1 justify-end">
              <!-- Reps Input -->
              <div class="flex items-center gap-1">
                <input
                  type="text"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  placeholder="0"
                  value="${currentReps}"
                  oninput="this.value = this.value.replace(/[^0-9]/g, ''); handleSetInput(${idx}, ${s}, 'reps', this.value)"
                  class="mobile-input w-14 py-1 px-2 bg-navy-800 border border-navy-700 rounded-lg text-center text-white font-bold placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                >
                <span class="text-[10px] font-bold text-gray-400">reps</span>
              </div>

              <!-- Weight Input (Triggers Auto-Done) -->
              <div class="flex items-center gap-1">
                <input
                  type="text"
                  inputmode="decimal"
                  placeholder="0"
                  value="${currentWeight}"
                  oninput="this.value = this.value.replace(/[^0-9.]/g, ''); handleSetInput(${idx}, ${s}, 'weight', this.value)"
                  class="mobile-input w-16 py-1 px-2 bg-navy-800 border border-navy-700 rounded-lg text-center text-cyan-400 font-bold placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                >
                <span class="text-[10px] font-bold text-gray-400">kg</span>
              </div>
            </div>

            <!-- Auto Done Indicator -->
            <div id="set-status-${idx}-${s}" class="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black transition-all shrink-0 ${
              isDone ? 'bg-cyan-500 text-navy-900 shadow-sm shadow-cyan-500/30' : 'bg-navy-800 text-gray-600 border border-navy-700'
            }">
              ${isDone ? '✓' : '•'}
            </div>
          </div>
        `;
      }

      return `
        <div class="flex flex-col gap-2 py-3 px-3.5 rounded-xl bg-navy-800 border border-navy-700 shadow-sm">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="text-xs font-black text-gray-500">${idx + 1}.</span>
              <span class="text-sm font-bold text-white truncate">${ex.name}</span>
            </div>
            <div class="text-[11px] text-cyan-400 font-bold shrink-0">
              ${ex.sets} sets
            </div>
          </div>
          <div class="space-y-1.5 pt-2 border-t border-navy-700 mt-0.5">
            ${setRowsHtml}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="flex items-center justify-between px-1">
        <div>
          <div class="text-[10px] font-bold uppercase tracking-widest text-cyan-500 flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span> Active Session
          </div>
          <h2 class="text-base font-black text-white">${activeWorkoutState.title}</h2>
        </div>
        <button onclick="completeWorkout()" class="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-cyan-500 text-navy-900 shadow-md shadow-cyan-500/20 hover:bg-cyan-400 transition-colors">
          Finish & Save
        </button>
      </div>
      <div class="space-y-2.5">
        ${exercisesHtml}
      </div>
    `;
  }
  lucide.createIcons();
}

// --- VIEW 2: ROUTINES ---
function renderRoutinesView() {
  const container = document.getElementById('routinesContainer');
  
  if (routines.length === 0) {
    container.innerHTML = `<p class="text-sm text-center text-gray-500 py-4">No routines created yet.</p>`;
    return;
  }

  container.innerHTML = routines.map((r, idx) => {
    const exListHtml = r.exercises.map(ex => `
      <div class="flex items-center justify-between text-[11px] py-1 border-b border-navy-700 last:border-none">
        <span class="text-gray-300 font-semibold truncate pr-2">${ex.name}</span>
        <span class="text-cyan-500 font-bold shrink-0">${ex.sets} sets</span>
      </div>
    `).join('');

    const isNext = cycleIndex === idx;
    const badgeHtml = isNext ? `<span class="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">Next</span>` : '';

    return `
      <div class="glass-card rounded-2xl p-3.5 bg-navy-800 border ${isNext ? 'border-cyan-500/50 ring-1 ring-cyan-500/30' : 'border-navy-700'} shadow-sm">
        <div class="flex items-start justify-between mb-2 pb-2 border-b border-navy-700">
          <div>
            <div class="flex items-center gap-1.5">
              <h3 class="text-sm font-extrabold text-white">${r.title}</h3>
              ${badgeHtml}
            </div>
            <p class="text-[10px] text-gray-400 mt-0.5">${r.exercises.length} exercises</p>
          </div>
          <div class="flex gap-1">
            <button onclick="openWorkoutModal('${r.id}', true)" class="p-1.5 rounded-lg text-gray-400 hover:text-white bg-navy-700 transition-colors"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
            <button onclick="deleteRoutine('${r.id}')" class="p-1.5 rounded-lg text-gray-400 hover:text-red-400 bg-navy-700 transition-colors"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
          </div>
        </div>
        <div class="space-y-0.5 bg-navy-900 p-2.5 rounded-xl border border-navy-700">
          ${exListHtml}
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

function deleteRoutine(id) {
  routines = routines.filter(r => r.id !== id);
  saveRoutines();
  validateCycleIndex();
  renderRoutinesView();
  renderHomeView();
}

// --- VIEW 3: MONTH & HISTORY ---
function changeCalendarMonth(delta) {
  calMonth += delta;
  if (calMonth > 11) {
    calMonth = 0;
    calYear += 1;
  } else if (calMonth < 0) {
    calMonth = 11;
    calYear -= 1;
  }
  renderMonthView();
}

function goToCurrentMonth() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
  selectedDateKey = formatDateKey(now);
  renderMonthView();
}

function selectCalendarDay(dateKey) {
  selectedDateKey = dateKey;
  renderMonthView();
}

function renderMonthView() {
  document.getElementById('calMonthTitle').textContent = `${monthsList[calMonth]} ${calYear}`;
  document.getElementById('calWeekdaysHeader').innerHTML = weekdaysList.map(d => `<div>${d}</div>`).join('');

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const rawFirstDay = new Date(calYear, calMonth, 1).getDay();
  const startOffset = (rawFirstDay + 6) % 7;

  const monthPrefix = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-`;
  const monthWorkouts = historyLog.filter(w => w.date.startsWith(monthPrefix));

  const uniqueTrainingDays = new Set(monthWorkouts.map(w => w.date));
  const daysTrainedCount = uniqueTrainingDays.size;
  const monthVolume = monthWorkouts.reduce((sum, w) => sum + w.getTotalVolume(), 0);
  
  const totalWorkoutsAllTime = historyLog.length;
  const totalVolumeAllTime = historyLog.reduce((sum, w) => sum + w.getTotalVolume(), 0);

  document.getElementById('monthDaysCount').textContent = daysTrainedCount;
  document.getElementById('monthVolumeStat').textContent = `${monthVolume.toLocaleString()} kg`;
  
  document.getElementById('statTotalWorkouts').textContent = totalWorkoutsAllTime;
  document.getElementById('statTotalVolume').innerHTML = `${totalVolumeAllTime.toLocaleString()} <span class="text-xs font-bold text-gray-500">kg</span>`;

  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';

  for (let i = 0; i < startOffset; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'aspect-square rounded-xl bg-transparent';
    grid.appendChild(emptyCell);
  }

  const todayKey = formatDateKey(new Date());

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${monthPrefix}${String(day).padStart(2, '0')}`;
    const dayWorkouts = historyLog.filter(w => w.date === dateKey);
    const hasWorkout = dayWorkouts.length > 0;
    const isToday = dateKey === todayKey;
    const isSelected = dateKey === selectedDateKey;

    const btn = document.createElement('button');
    btn.onclick = () => selectCalendarDay(dateKey);

    let cellClasses = 'aspect-square rounded-xl flex flex-col items-center justify-center relative transition border text-xs font-bold shadow-sm hover:opacity-80 ';
    if (hasWorkout) {
      cellClasses += 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400 ';
    } else {
      cellClasses += 'bg-navy-900 border-navy-700 text-gray-500 ';
    }

    if (isSelected) {
      cellClasses += 'ring-2 ring-white ring-offset-1 ring-offset-navy-800 ';
    } else if (isToday) {
      cellClasses += 'ring-1 ring-cyan-500/50 ';
    }

    btn.className = cellClasses;

    const dotsHtml = hasWorkout
      ? `<div class="flex gap-0.5 mt-0.5">${dayWorkouts.map(() => `<span class="w-1 h-1 rounded-full bg-cyan-500"></span>`).join('')}</div>`
      : '';

    btn.innerHTML = `<span>${day}</span>${dotsHtml}`;
    grid.appendChild(btn);
  }

  renderSelectedDayCard();
  lucide.createIcons();
}

function renderSelectedDayCard() {
  const card = document.getElementById('selectedDayCard');
  const dayWorkouts = historyLog.filter(w => w.date === selectedDateKey);

  if (dayWorkouts.length === 0) {
    card.innerHTML = `
      <div class="flex items-center justify-between mb-1.5">
        <span class="text-xs font-bold text-white">${selectedDateKey}</span>
        <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-navy-900 text-gray-500 border border-navy-700">Rest Day</span>
      </div>
      <p class="text-xs text-gray-400 mb-1">No workout logged for this date.</p>
    `;
    return;
  }

  const listHtml = dayWorkouts.map(w => `
    <div class="p-3 rounded-xl bg-navy-800 border border-navy-700 shadow-sm space-y-1.5 opacity-90">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-extrabold text-white truncate pr-2">${w.title}</h4>
        <button onclick="deleteHistoryItem('${w.id}')" class="p-1 text-gray-500 hover:text-red-400 hover:bg-navy-700 rounded-lg transition-colors">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
      <div class="text-[11px] text-gray-400 flex items-center gap-2">
        <span>${w.exercises.length} exercises</span>
        <span>•</span>
        <span class="text-cyan-500 font-bold">${w.getTotalVolume().toLocaleString()} kg</span>
      </div>
      <div class="space-y-1 pt-1 border-t border-navy-700 mt-1.5">
        ${w.exercises.map(ex => {
          const completedDetails = ex.setCompleted
            .map((done, i) => done ? `${ex.setReps[i] || 0}×${ex.setWeights[i]}kg` : null)
            .filter(Boolean)
            .join(', ');

          const displayDetails = completedDetails
            ? `${ex.getCompletedCount()}/${ex.sets}s (${completedDetails})`
            : `0/${ex.sets} sets`;

          return `
            <div class="flex justify-between text-[11px] text-gray-300 gap-2">
              <span class="truncate">${ex.name}</span>
              <span class="font-semibold text-gray-400 shrink-0">${displayDetails}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');

  card.innerHTML = `
    <div class="flex items-center justify-between mb-2.5">
      <span class="text-xs font-bold text-white flex items-center gap-1.5">
        <i data-lucide="calendar" class="w-3.5 h-3.5 text-cyan-500"></i>
        ${selectedDateKey}
      </span>
      <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">Active Day</span>
    </div>
    <div class="space-y-2">
      ${listHtml}
    </div>
  `;
}

function deleteHistoryItem(id) {
  historyLog = historyLog.filter(w => w.id !== id);
  saveHistory();
  renderMonthView();
}

// ==========================================
// 5. MODAL (ROUTINES - NAME & SETS ONLY)
// ==========================================
function openWorkoutModal(routineId = null, isRoutineMode = true) {
  const modal = document.getElementById('workoutModal');
  const rowsContainer = document.getElementById('exerciseRowsContainer');
  rowsContainer.innerHTML = '';
  
  document.getElementById('isRoutineMode').value = isRoutineMode ? 'true' : 'false';

  if (isRoutineMode) {
    document.getElementById('dateFieldContainer').style.display = 'none';
    if (routineId) {
      const routine = routines.find(r => r.id === routineId);
      if (!routine) return;
      document.getElementById('modalTitle').textContent = 'Edit Routine';
      document.getElementById('editModalId').value = routine.id;
      document.getElementById('workoutTitle').value = routine.title;
      routine.exercises.forEach(ex => addExerciseRow(ex));
    } else {
      document.getElementById('modalTitle').textContent = 'New Routine';
      document.getElementById('editModalId').value = '';
      document.getElementById('workoutTitle').value = '';
      addExerciseRow();
    }
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  lucide.createIcons();
}

function closeWorkoutModal() {
  const modal = document.getElementById('workoutModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function addExerciseRow(exercise = null) {
  const container = document.getElementById('exerciseRowsContainer');
  const row = document.createElement('div');
  row.className = 'exercise-row bg-navy-800 border border-navy-700 p-2.5 rounded-xl flex items-center gap-2 shadow-sm';

  row.innerHTML = `
    <input
      type="text"
      placeholder="Exercise name"
      required
      value="${exercise ? exercise.name : ''}"
      class="ex-name mobile-input flex-1 min-w-0 px-3 py-1.5 bg-navy-900 border border-navy-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
    >
    <div class="flex items-center gap-1.5 shrink-0">
      <input
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        oninput="this.value = this.value.replace(/[^0-9]/g, '')"
        placeholder="Sets"
        required
        value="${exercise ? exercise.sets : '3'}"
        class="ex-sets mobile-input w-14 px-2 py-1.5 bg-navy-900 border border-navy-700 rounded-lg text-cyan-400 font-bold text-center focus:outline-none focus:border-cyan-500 transition-colors"
      >
      <span class="text-[11px] font-bold text-gray-400">sets</span>
    </div>
    <button
      type="button"
      onclick="this.closest('.exercise-row').remove()"
      class="p-1.5 text-gray-500 hover:text-red-400 hover:bg-navy-700 rounded-lg shrink-0 transition-colors"
    >
      <i data-lucide="trash-2" class="w-4 h-4"></i>
    </button>
  `;
  container.appendChild(row);
  lucide.createIcons();
}

function saveModalData(event) {
  event.preventDefault();
  const editId = document.getElementById('editModalId').value;
  const isRoutine = document.getElementById('isRoutineMode').value === 'true';
  const title = document.getElementById('workoutTitle').value.trim();

  const rowElements = document.querySelectorAll('.exercise-row');
  const exercises = [];

  rowElements.forEach(row => {
    const name = row.querySelector('.ex-name').value.trim();
    const sets = parseInt(row.querySelector('.ex-sets').value, 10) || 1;

    if (name) {
      exercises.push(new Exercise(name, sets));
    }
  });

  if (exercises.length === 0) return;

  if (isRoutine) {
    if (editId) {
      const index = routines.findIndex(r => r.id === editId);
      if (index !== -1) routines[index] = new Routine(editId, title, exercises);
    } else {
      routines.push(new Routine('r-' + Date.now(), title, exercises));
    }
    saveRoutines();
    renderRoutinesView();
    renderHomeView();
  }
  closeWorkoutModal();
}

function renderAll() {
  renderHomeView();
  if (activeView === 'routines') renderRoutinesView();
  if (activeView === 'month') renderMonthView();
}

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  renderAll();
});