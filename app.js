if (window.__pulseNotesAppBootstrapped) {
  console.warn('Pulse Notes already initialized; skipping duplicate bootstrap.');
} else {
  window.__pulseNotesAppBootstrapped = true;

  (() => {
  const STORAGE_KEY = 'pulse-notes-actions-v1';
  const SYNC_STORAGE_KEY = 'pulse-notes-sync-state';
  const SYNC_URL = `${window.location.protocol}//${window.location.hostname}:9000/api/actions`;
  const VIEW_FILTERS = ['all', 'work', 'personal'];
  const SUPABASE_URL = window.SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';
  const SUPABASE_READY = Boolean(
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    window.supabase &&
    SUPABASE_URL !== 'https://YOUR_PROJECT_ID.supabase.co' &&
    SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY'
  );
  const supabaseClient = SUPABASE_READY ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

  let selectedCategory = 'work';
  let selectedImportance = 2;
  let selectedUrgency = 2;
  let currentFilter = 'all';
  let currentCategoryFilter = 'all';
  let currentSort = 'priority';
  let currentView = 'list';
  let isDoneSectionExpanded = false;

const actionInput = document.getElementById('actionInput');
const notesInput = document.getElementById('notesInput');
const dueDateInput = document.getElementById('dueDateInput');
const addActionButton = document.getElementById('addActionButton');
const cancelActionButton = document.getElementById('cancelActionButton');
const voiceButton = document.getElementById('voiceButton');
const darkModeToggle = document.getElementById('darkModeToggle');
const composerCard = document.getElementById('composerCard');
const composerExpandButton = document.getElementById('composerExpandButton');
const actionList = document.getElementById('actionList');
const syncButton = document.getElementById('syncButton');
const installButton = document.getElementById('installButton');
const syncStatusText = document.getElementById('syncStatusText');
  const authStatusText = document.getElementById('authStatusText');
  const authEmailInput = document.getElementById('authEmailInput');
  const authSubmitButton = document.getElementById('authSubmitButton');
  const authCodeInput = document.getElementById('authCodeInput');
  const authVerifyButton = document.getElementById('authVerifyButton');
  const authSignOutButton = document.getElementById('authSignOutButton');
  const authHintText = document.getElementById('authHintText');
  const todayCount = document.getElementById('todayCount');
  const highPriorityCount = document.getElementById('highPriorityCount');
  const overdueCount = document.getElementById('overdueCount');
  const doneCount = document.getElementById('doneCount');

  let currentUser = null;

  const state = {
    actions: loadActions(),
    editingId: null,
  };

  function generateId() {
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;

      const parts = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0'));
      return `${parts.slice(0, 4).join('')}-${parts.slice(4, 6).join('')}-${parts.slice(6, 8).join('')}-${parts.slice(8, 10).join('')}-${parts.slice(10, 16).join('')}`;
    }

    return `pulse-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function defaultActions() {
  if (typeof window.buildDemoActions === 'function') {
    return window.buildDemoActions();
  }

  return [
    {
      id: generateId(),
      title: 'Review launch plan with the team',
      category: 'work',
      importance: 3,
      urgency: 3,
      notes: 'Need the final call before 4 PM',
      createdAt: new Date().toISOString(),
      completed: false,
    },
    {
      id: generateId(),
      title: 'Book dentist appointment',
      category: 'personal',
      importance: 2,
      urgency: 2,
      notes: 'Call the clinic for early available slot',
      createdAt: new Date().toISOString(),
      completed: false,
    },
  ];
}

function dedupeActions(actions = []) {
  const map = new Map();

  actions.forEach((action) => {
    if (!action || !action.id) return;

    const current = map.get(action.id);
    if (!current) {
      map.set(action.id, action);
      return;
    }

    const currentTime = new Date(action.updatedAt || action.createdAt || 0).getTime();
    const previousTime = new Date(current.updatedAt || current.createdAt || 0).getTime();

    if (currentTime >= previousTime) {
      map.set(action.id, action);
    }
  });

  return [...map.values()].filter((action) => !action.deletedAt);
}

function loadActions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultActions();

    const parsed = JSON.parse(raw);
    const normalized = Array.isArray(parsed) ? parsed : [];
    return normalized.length ? dedupeActions(normalized) : defaultActions();
  } catch (error) {
    return defaultActions();
  }
}

function saveActions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dedupeActions(state.actions)));
}

function isDeleted(action) {
  return Boolean(action && action.deletedAt);
}

function getSyncState() {
  try {
    return JSON.parse(localStorage.getItem(SYNC_STORAGE_KEY) || '{}');
  } catch (error) {
    return {};
  }
}

function setSyncState(nextState) {
  localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(nextState));
}

function setSyncStatus(label, isSynced = false) {
  if (!syncStatusText) return;
  syncStatusText.textContent = label;
  syncStatusText.style.color = isSynced ? '#16a34a' : '#f59e0b';
}

function setAuthStatus(label) {
  if (!authStatusText) return;
  authStatusText.textContent = label;
}

function setAuthHint(label) {
  if (!authHintText) return;
  authHintText.textContent = label;
}

function getActionOwnerId(action) {
  return action?.user_id || action?.userId || null;
}

function isActionOwnedByCurrentUser(action) {
  if (!currentUser) return false;
  return getActionOwnerId(action) === currentUser.id;
}

function toSupabaseRow(action) {
  return {
    id: action.id,
    user_id: currentUser ? currentUser.id : action.user_id || null,
    title: action.title || '',
    category: action.category || 'work',
    importance: Number(action.importance || 2),
    urgency: Number(action.urgency || 2),
    notes: action.notes || '',
    due_date: action.dueDate || null,
    created_at: action.createdAt || new Date().toISOString(),
    updated_at: action.updatedAt || action.createdAt || new Date().toISOString(),
    completed: Boolean(action.completed),
    deleted_at: action.deletedAt || null,
    icon: action.icon || null,
  };
}

function fromSupabaseRow(row) {
  return {
    ...row,
    userId: row.user_id || row.userId || null,
    dueDate: row.due_date || null,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || row.createdAt || new Date().toISOString(),
    deletedAt: row.deleted_at || row.deletedAt || null,
  };
}

async function syncActionsToServer() {
  if (supabaseClient) {
    if (!currentUser) {
      setSyncStatus('Sign in required', false);
      return;
    }

    try {
      setSyncStatus('Syncing...', false);

      const rows = state.actions
        .filter((action) => isActionOwnedByCurrentUser(action) || action.id === null)
        .map(toSupabaseRow)
        .filter((row) => row.user_id);

      const { error } = await supabaseClient.from('actions').upsert(rows, { onConflict: 'id' });
      if (error) throw error;

      const { data } = await supabaseClient.from('actions').select('*').eq('user_id', currentUser.id);
      const actions = Array.isArray(data) ? dedupeActions(data.map(fromSupabaseRow)) : [];
      state.actions = actions;
      saveActions();
      setSyncState({ lastSyncedAt: new Date().toISOString(), status: 'synced' });
      setSyncStatus('Synced', true);
      renderActions();
      return;
    } catch (error) {
      const last = getSyncState();
      setSyncState({ ...last, status: 'offline', lastError: String(error) });
      setSyncStatus('Offline', false);
      return;
    }
  }

  const payload = { actions: state.actions.map((action) => ({ ...action, updatedAt: action.updatedAt || action.createdAt })) };

  try {
    setSyncStatus('Syncing...', false);
    const response = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Sync request failed');
    }

    const result = await response.json();
    const actions = Array.isArray(result.actions) ? dedupeActions(result.actions) : [];
    state.actions = actions;
    saveActions();
    setSyncState({ lastSyncedAt: new Date().toISOString(), status: 'synced' });
    setSyncStatus('Synced', true);
    renderActions();
  } catch (error) {
    const last = getSyncState();
    setSyncState({ ...last, status: 'offline', lastError: String(error) });
    setSyncStatus('Offline', false);
  }
}

async function pullActionsFromServer({ silent = false } = {}) {
  if (supabaseClient) {
    if (!currentUser) {
      state.actions = [];
      if (!silent) setSyncStatus('Sign in required', false);
      renderActions();
      return;
    }

    try {
      const { data, error } = await supabaseClient.from('actions').select('*').eq('user_id', currentUser.id);
      if (error) {
        if (!silent) setSyncStatus('Offline', false);
        return;
      }

      const remoteActions = Array.isArray(data) ? data.map(fromSupabaseRow) : [];
      const merged = mergeActions(remoteActions, state.actions.filter((action) => isActionOwnedByCurrentUser(action)));
      state.actions = dedupeActions(merged);
      saveActions();
      renderActions();

      if (!silent) {
        setSyncState({ lastSyncedAt: new Date().toISOString(), status: 'synced' });
        setSyncStatus('Synced', true);
      }
      return;
    } catch (error) {
      if (!silent) setSyncStatus('Offline', false);
      return;
    }
  }

  try {
    const response = await fetch(SYNC_URL, { method: 'GET' });
    if (!response.ok) {
      if (!silent) setSyncStatus('Offline', false);
      return;
    }

    const result = await response.json();
    const remoteActions = Array.isArray(result.actions) ? result.actions : [];
    const merged = mergeActions(remoteActions, state.actions);
    state.actions = dedupeActions(merged);
    saveActions();
    renderActions();

    if (!silent) {
      setSyncState({ lastSyncedAt: new Date().toISOString(), status: 'synced' });
      setSyncStatus('Synced', true);
    }
  } catch (error) {
    if (!silent) setSyncStatus('Offline', false);
  }
}

function mergeActions(existing = [], incoming = []) {
  const map = new Map();

  [...existing, ...incoming].forEach((action) => {
    if (!action || !action.id) return;

    const current = map.get(action.id);
    if (!current) {
      map.set(action.id, action);
      return;
    }

    const currentTime = new Date(action.updatedAt || action.createdAt || 0).getTime();
    const previousTime = new Date(current.updatedAt || current.createdAt || 0).getTime();

    if (currentTime > previousTime) {
      map.set(action.id, action);
      return;
    }

    if (currentTime === previousTime && action.deletedAt && !current.deletedAt) {
      map.set(action.id, action);
    }
  });

  return [...map.values()]
    .filter((action) => !action.deletedAt)
    .sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
}

function priorityScore(action) {
  if (typeof window.priorityScore === 'function') {
    return window.priorityScore(action);
  }

  return Number(action.importance || 2) * 10 + Number(action.urgency || 2) * 7 + (action.completed ? -100 : 0);
}

function isOverdue(action) {
  if (typeof window.isOverdue === 'function') {
    return window.isOverdue(action);
  }

  if (action.completed) return false;
  if (!action.dueDate) {
    const hoursSinceCreated = (Date.now() - new Date(action.createdAt).getTime()) / (1000 * 60 * 60);
    return action.urgency >= 3 && hoursSinceCreated >= 24;
  }

  return new Date(action.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));
}

function isDueToday(action) {
  if (typeof window.isDueToday === 'function') {
    return window.isDueToday(action);
  }

  if (!action.dueDate) return false;
  const due = new Date(action.dueDate);
  const today = new Date();
  return due.toDateString() === today.toDateString();
}

function getActionIcon(title) {
  const normalized = title.toLowerCase();
  if (/(call|phone|ring|message|text|email|reply|chat)/.test(normalized)) return '📞';
  if (/(meeting|call|review|sync|plan|brief|presentation|update)/.test(normalized)) return '🗓️';
  if (/(appoint|doctor|dentist|clinic|visit|book)/.test(normalized)) return '🩺';
  if (/(buy|shop|grocer|order|pay|invoice|bill)/.test(normalized)) return '🛒';
  if (/(travel|flight|train|book|trip|airport)/.test(normalized)) return '✈️';
  if (/(write|draft|report|summary|document|post|email)/.test(normalized)) return '✍️';
  if (/(family|mum|dad|friend|date|dinner|party)/.test(normalized)) return '💛';
  if (/(project|build|launch|design|code|fix|debug)/.test(normalized)) return '🚀';
  return '✨';
}

function sortActions(actions) {
  if (typeof window.sortActions === 'function') {
    return window.sortActions(actions, currentSort);
  }

  return [...actions].sort((a, b) => {
    if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);

    if (currentSort === 'recent') {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }

    if (currentSort === 'urgent') {
      const urgencyDiff = (Number(b.urgency) || 2) - (Number(a.urgency) || 2);
      if (urgencyDiff !== 0) return urgencyDiff;
      const overdueDiff = Number(isOverdue(b)) - Number(isOverdue(a));
      if (overdueDiff !== 0) return overdueDiff;
      const importanceDiff = (Number(b.importance) || 2) - (Number(a.importance) || 2);
      if (importanceDiff !== 0) return importanceDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    }

    if (currentSort === 'overdue') {
      const overdueDiff = Number(isOverdue(b)) - Number(isOverdue(a));
      if (overdueDiff !== 0) return overdueDiff;

      const dueA = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const dueB = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      if (dueA !== dueB) return dueA - dueB;

      const scoreDiff = priorityScore(b) - priorityScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    }

    const scoreDiff = priorityScore(b) - priorityScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function getFilteredActions() {
  const visibleActions = supabaseClient && currentUser
    ? state.actions.filter((action) => isActionOwnedByCurrentUser(action))
    : state.actions.filter((action) => !supabaseClient || !currentUser ? true : isActionOwnedByCurrentUser(action));

  const filtered = visibleActions.filter((action) => {
    if (isDeleted(action)) return false;

    if (currentCategoryFilter !== 'all' && action.category !== currentCategoryFilter) return false;

    if (currentFilter === 'all') return true;
    if (currentFilter === 'done') return action.completed;
    if (currentFilter === 'today') return !action.completed && (isDueToday(action) || new Date(action.createdAt).toDateString() === new Date().toDateString());
    if (currentFilter === 'high') return !action.completed && Number(action.importance) >= 3 && Number(action.urgency) >= 3;
    if (currentFilter === 'late') return !action.completed && isOverdue(action);

    return true;
  });

  return sortActions(filtered);
}

function badgeText(type, value) {
  if (type === 'importance') {
    if (value === 1) return 'Low importance';
    if (value === 2) return 'Medium importance';
    return 'High importance';
  }

  if (value === 1) return 'Low urgency';
  if (value === 2) return 'Medium urgency';
  return 'High urgency';
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatActionTimestamp(action) {
  const timestamp = new Date(action.updatedAt || action.createdAt);
  if (Number.isNaN(timestamp.getTime())) return '';

  const isUpdated = Boolean(action.updatedAt) && action.updatedAt !== action.createdAt;
  const label = isUpdated ? 'Updated' : 'Created';
  const value = timestamp.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${label} ${value}`;
}

function renderSummary() {
  if (supabaseClient && !currentUser) {
    todayCount.textContent = '0';
    highPriorityCount.textContent = '0';
    overdueCount.textContent = '0';
    doneCount.textContent = '0';
    return;
  }

  const visibleActions = supabaseClient && currentUser
    ? state.actions.filter((action) => isActionOwnedByCurrentUser(action))
    : state.actions;

  const today = visibleActions.filter((action) => {
    if (isDeleted(action)) return false;
    const created = new Date(action.createdAt);
    const now = new Date();
    return created.toDateString() === now.toDateString();
  }).length + visibleActions.filter((action) => !isDeleted(action) && isDueToday(action) && !action.completed).length;

  const highPriority = visibleActions.filter((action) => !isDeleted(action) && action.importance >= 3 && action.urgency >= 3 && !action.completed).length;
  const overdue = visibleActions.filter((action) => !isDeleted(action) && isOverdue(action)).length;
  const done = visibleActions.filter((action) => !isDeleted(action) && action.completed).length;

  todayCount.textContent = String(today);
  highPriorityCount.textContent = String(highPriority);
  overdueCount.textContent = String(overdue);
  doneCount.textContent = String(done);
}

function getTimelineGroups(actions) {
  const grouped = new Map();

  actions.forEach((action) => {
    const dateKey = action.dueDate ? new Date(action.dueDate).toISOString().split('T')[0] : (new Date(action.createdAt).toISOString().split('T')[0]);
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey).push(action);
  });

  return [...grouped.entries()].sort(([a], [b]) => new Date(a) - new Date(b));
}

function renderTimeline() {
  const actions = getFilteredActions();

  if (!actions.length) {
    actionList.innerHTML = '<div class="timeline-empty">No actions in this time range yet.</div>';
    renderSummary();
    return;
  }

  const groups = getTimelineGroups(actions);

  const markup = groups
    .map(([dateKey, group]) => {
      const date = new Date(dateKey);
      const dayLabel = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const dayName = date.toLocaleDateString(undefined, { weekday: 'short' });

      const cards = group
        .map((action) => {
          const icon = action.icon || getActionIcon(action.title);
          const escapedTitle = escapeHtml(action.title || 'Untitled action');
          return `
            <div class="timeline-item" data-id="${action.id}">
              <div class="mini-icon">${icon}</div>
              <div class="mini-content">
                <h4>${escapedTitle}</h4>
                <div class="timeline-meta">
                  <span class="mini-tag ${action.category}">${action.category === 'work' ? 'Work' : 'Personal'}</span>
                  <span class="mini-tag">${badgeText('importance', action.importance)}</span>
                </div>
              </div>
            </div>
          `;
        })
        .join('');

      return `
        <div class="timeline-day">
          <div class="timeline-day-header">
            <strong>${dayName}</strong>
            <span>${dayLabel}</span>
          </div>
          <div class="timeline-items">${cards}</div>
        </div>
      `;
    })
    .join('');

  actionList.innerHTML = `<div class="timeline-view">${markup}</div>`;
  renderSummary();
}

function renderDoneSection(doneActions) {
  if (!doneActions.length) return '';

  const visibleDone = isDoneSectionExpanded ? doneActions : doneActions.slice(0, 2);
  const itemsMarkup = visibleDone
    .map((action) => {
      const escapedTitle = escapeHtml(action.title || 'Untitled action');
      const icon = action.icon || getActionIcon(action.title);

      return `
        <article class="action-item completed done-item ${action.category}" data-id="${action.id}">
          <div class="action-main">
            <div class="title-row compact-title-row">
              <div class="icon-wrap">${icon}</div>
              <div class="action-header">
                <h3 class="action-title">${escapedTitle}</h3>
              </div>
            </div>

            <div class="card-timestamp">${formatActionTimestamp(action)}</div>
          </div>

          <div class="action-controls compact-controls">
            <button class="action-toggle" type="button" data-action="toggle" data-id="${action.id}" aria-label="Undo action" title="Undo action">↺</button>
            <button class="action-delete" type="button" data-action="delete" data-id="${action.id}" aria-label="Delete action" title="Delete action">🗑</button>
          </div>
        </article>
      `;
    })
    .join('');

  return `
    <section class="completed-section ${isDoneSectionExpanded ? 'expanded' : 'collapsed'}">
      <button class="done-toggle" type="button" aria-expanded="${isDoneSectionExpanded ? 'true' : 'false'}">
        <span>Completed</span>
        <span class="done-count">${doneActions.length}</span>
        <span class="done-chevron">${isDoneSectionExpanded ? '▾' : '▸'}</span>
      </button>
      <div class="done-list">${itemsMarkup}</div>
    </section>
  `;
}

function renderActions() {
  if (supabaseClient && !currentUser) {
    actionList.innerHTML = '<div class="empty-state">Please sign in to view your actions.</div>';
    renderSummary();
    return;
  }

  if (currentView === 'timeline') {
    renderTimeline();
    return;
  }

  const actions = getFilteredActions();
  const activeActions = actions.filter((action) => !action.completed);
  const doneActions = actions.filter((action) => action.completed);

  if (!actions.length) {
    actionList.innerHTML = `<div class="empty-state">No actions here yet. Capture your next move.</div>`;
    renderSummary();
    return;
  }

  const activeMarkup = activeActions
    .map((action) => {
      const escapedTitle = escapeHtml(action.title || 'Untitled action');
      const escapedNote = action.notes ? escapeHtml(action.notes) : '';
      const categoryLabel = action.category === 'work' ? 'Work' : 'Personal';
      const className = action.completed ? 'action-item completed' : 'action-item';
      const overdueClass = isOverdue(action) ? 'overdue' : '';
      const icon = action.icon || getActionIcon(action.title);
      const dueDateBadge = action.dueDate
        ? `<span class="badge ${isDueToday(action) ? 'due-today' : 'overdue-badge'}">${new Date(action.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>`
        : '';

      const isEditing = state.editingId === action.id;
      const dueDateValue = formatDateForInput(action.dueDate);

      return `
        <article class="${className} ${action.category} ${overdueClass}" data-id="${action.id}">
          <div class="action-main">
            <div class="title-row">
              <div class="icon-wrap">${icon}</div>
              <div class="action-header">
                <h3 class="action-title">${escapedTitle}</h3>
              </div>
            </div>

            <div class="action-meta">
              <span class="badge ${action.category}">${categoryLabel}</span>
              <span class="badge importance-${action.importance}">${badgeText('importance', action.importance)}</span>
              <span class="badge urgency-${action.urgency}">${badgeText('urgency', action.urgency)}</span>
              ${dueDateBadge}
              ${isOverdue(action) ? '<span class="badge overdue-badge">Overdue</span>' : ''}
            </div>

            ${escapedNote ? `<p class="action-note">${escapedNote}</p>` : ''}
            <div class="card-timestamp">${formatActionTimestamp(action)}</div>

            ${isEditing ? `
              <form class="action-editor-form" data-edit-id="${action.id}">
                <label>
                  <span>Title</span>
                  <input class="edit-title-input" name="title" type="text" value="${escapeHtml(action.title || '')}" required />
                </label>
                <label>
                  <span>Notes</span>
                  <textarea class="edit-note-input" name="notes" rows="3">${escapedNote}</textarea>
                </label>
                <div class="editor-grid">
                  <label>
                    <span>Category</span>
                    <select class="edit-category" name="category">
                      <option value="work" ${action.category === 'work' ? 'selected' : ''}>Work</option>
                      <option value="personal" ${action.category === 'personal' ? 'selected' : ''}>Personal</option>
                    </select>
                  </label>
                  <label>
                    <span>Importance</span>
                    <select class="edit-importance" name="importance">
                      <option value="1" ${action.importance === 1 ? 'selected' : ''}>Low</option>
                      <option value="2" ${action.importance === 2 ? 'selected' : ''}>Medium</option>
                      <option value="3" ${action.importance === 3 ? 'selected' : ''}>High</option>
                    </select>
                  </label>
                  <label>
                    <span>Urgency</span>
                    <select class="edit-urgency" name="urgency">
                      <option value="1" ${action.urgency === 1 ? 'selected' : ''}>Low</option>
                      <option value="2" ${action.urgency === 2 ? 'selected' : ''}>Medium</option>
                      <option value="3" ${action.urgency === 3 ? 'selected' : ''}>High</option>
                    </select>
                  </label>
                  <label>
                    <span>Reminder</span>
                    <input class="edit-date-input" name="dueDate" type="date" value="${dueDateValue}" />
                  </label>
                </div>
                <div class="editor-actions">
                  <button type="submit" class="action-save" data-action="save-edit" data-id="${action.id}">Save</button>
                  <button type="button" class="action-cancel" data-action="cancel-edit" data-id="${action.id}">Cancel</button>
                </div>
              </form>
            ` : ''}
          </div>

          <div class="action-controls">
            <button class="action-toggle" type="button" data-action="toggle" data-id="${action.id}" aria-label="${action.completed ? 'Undo action' : 'Mark action done'}" title="${action.completed ? 'Undo action' : 'Mark action done'}">${action.completed ? '↺' : '✓'}</button>
            <button class="action-edit" type="button" data-action="edit" data-id="${action.id}" aria-label="Edit action" title="Edit action">✎</button>
            <button class="action-delete" type="button" data-action="delete" data-id="${action.id}" aria-label="Delete action" title="Delete action">🗑</button>
          </div>
        </article>
      `;
    })
    .join('');

  actionList.innerHTML = `${activeMarkup}${renderDoneSection(doneActions)}`;
  renderSummary();
}

function syncCategorySelection() {
  document.querySelectorAll('.category-pill').forEach((button) => {
    button.classList.toggle('active', button.dataset.category === selectedCategory);
  });
}

function syncContextFilterSelection() {
  document.querySelectorAll('[data-category-filter]').forEach((button) => {
    const isActive = button.dataset.categoryFilter === currentCategoryFilter;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function syncSummaryFilterSelection() {
  document.querySelectorAll('.filter-item').forEach((button) => {
    const isActive = button.dataset.filter === currentFilter;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function syncImportanceSelection() {
  document.querySelectorAll('[data-importance]').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.importance) === selectedImportance);
  });
}

function syncUrgencySelection() {
  document.querySelectorAll('[data-urgency]').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.urgency) === selectedUrgency);
  });
}

function resetComposerForm() {
  actionInput.value = '';
  if (notesInput) notesInput.value = '';
  dueDateInput.value = '';
  selectedCategory = 'work';
  selectedImportance = 2;
  selectedUrgency = 2;
  syncCategorySelection();
  syncImportanceSelection();
  syncUrgencySelection();
}

function cancelComposer() {
  resetComposerForm();
  setComposerExpanded(false);
}

function addAction() {
  const title = actionInput.value.trim();
  if (!title) {
    actionInput.focus();
    return;
  }

  const notes = notesInput ? notesInput.value.trim() : '';
  const dueDateValue = dueDateInput.value ? new Date(`${dueDateInput.value}T00:00:00`) : null;
  const now = new Date().toISOString();

  const action = {
    id: generateId(),
    userId: currentUser ? currentUser.id : null,
    title,
    category: selectedCategory,
    importance: selectedImportance,
    urgency: selectedUrgency,
    notes,
    dueDate: dueDateValue ? dueDateValue.toISOString() : null,
    createdAt: now,
    updatedAt: now,
    completed: false,
    icon: getActionIcon(title),
  };

  state.actions.push(action);
  saveActions();
  resetComposerForm();
  setComposerExpanded(false);
  renderActions();
}

function toggleAction(id) {
  state.actions = state.actions.map((action) => {
    if (action.id === id) {
      return {
        ...action,
        userId: action.userId || (currentUser ? currentUser.id : null),
        completed: !action.completed,
        updatedAt: new Date().toISOString(),
      };
    }
    return action;
  });
  saveActions();
  renderActions();
}

function deleteAction(id) {
  const timestamp = new Date().toISOString();
  state.actions = state.actions.map((action) => {
    if (action.id !== id) return action;
    return {
      ...action,
      userId: action.userId || (currentUser ? currentUser.id : null),
      deletedAt: timestamp,
      updatedAt: timestamp,
    };
  });
  saveActions();
  renderActions();
}

function startEditAction(id) {
  state.editingId = id;
  renderActions();
  const input = document.querySelector(`.action-editor-form[data-edit-id="${id}"] .edit-title-input`);
  input?.focus();
  input?.select();
}

function cancelEditAction() {
  state.editingId = null;
  renderActions();
}

function saveEditAction(id) {
  const form = document.querySelector(`.action-editor-form[data-edit-id="${id}"]`);
  if (!form) return;

  const title = (form.querySelector('[name="title"]').value || '').trim();
  if (!title) {
    form.querySelector('[name="title"]').focus();
    return;
  }

  const notes = form.querySelector('[name="notes"]').value.trim();
  const category = form.querySelector('[name="category"]').value;
  const importance = Number(form.querySelector('[name="importance"]').value || 2);
  const urgency = Number(form.querySelector('[name="urgency"]').value || 2);
  const dueDate = form.querySelector('[name="dueDate"]').value || null;

  state.actions = state.actions.map((action) => {
    if (action.id !== id) return action;
    return {
      ...action,
      userId: action.userId || (currentUser ? currentUser.id : null),
      title,
      notes,
      category,
      importance,
      urgency,
      dueDate: dueDate ? new Date(`${dueDate}T00:00:00`).toISOString() : null,
      updatedAt: new Date().toISOString(),
      icon: action.icon || getActionIcon(title),
    };
  });

  saveActions();
  state.editingId = null;
  renderActions();
}

function handleActionListClick(event) {
  const target = event.target.closest('button');
  if (!target) return;

  if (target.closest('.done-toggle')) {
    isDoneSectionExpanded = !isDoneSectionExpanded;
    renderActions();
    return;
  }

  const id = target.dataset.id;
  const actionType = target.dataset.action;

  if (actionType === 'edit') {
    startEditAction(id);
    return;
  }

  if (actionType === 'cancel-edit') {
    cancelEditAction();
    return;
  }

  if (actionType === 'save-edit') {
    saveEditAction(id);
    return;
  }

  if (actionType === 'toggle') toggleAction(id);
  if (actionType === 'delete') deleteAction(id);
}

function clearSwipeIntent(article) {
  if (!article) return;
  article.classList.remove('swipe-left', 'swipe-right');
  article.style.transition = 'transform 0.22s ease';
  article.style.transform = '';
  article.style.background = '';
  article.style.borderColor = '';
  article.style.boxShadow = '';
  delete article.__dragStartX;
  delete article.__dragging;
  delete article.__dragStartY;
  delete article.__swipeLocked;
}

function isInteractiveTarget(target) {
  return Boolean(target && target.closest && target.closest('button, input, textarea, select, label, form'));
}

function applySwipeVisual(article, deltaX) {
  const boundedDelta = Math.max(-100, Math.min(100, deltaX));
  const isDarkMode = document.body.classList.contains('dark-mode');
  const isDoneSwipe = boundedDelta < -55;
  const isDeleteSwipe = boundedDelta > 55;

  article.style.transition = 'none';
  article.style.transform = `translate3d(${boundedDelta}px, 0, 0)`;
  article.classList.toggle('swipe-left', isDoneSwipe);
  article.classList.toggle('swipe-right', isDeleteSwipe);

  if (isDoneSwipe) {
    article.style.background = isDarkMode ? 'rgba(22, 163, 74, 0.12)' : 'rgba(22, 163, 74, 0.08)';
    article.style.borderColor = isDarkMode ? 'rgba(34, 197, 94, 0.8)' : 'rgba(22, 163, 74, 0.6)';
    article.style.boxShadow = isDarkMode
      ? '0 0 0 1px rgba(34, 197, 94, 0.7), 0 14px 30px rgba(34, 197, 94, 0.18), 0 0 26px rgba(34, 197, 94, 0.25), 0 0 50px rgba(34, 197, 94, 0.15)'
      : '0 0 0 1px rgba(22, 163, 74, 0.45), 0 14px 30px rgba(22, 163, 74, 0.22), 0 0 26px rgba(34, 197, 94, 0.35), 0 0 50px rgba(34, 197, 94, 0.18)';
    return;
  }

  if (isDeleteSwipe) {
    article.style.background = isDarkMode ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)';
    article.style.borderColor = isDarkMode ? 'rgba(248, 113, 113, 0.8)' : 'rgba(239, 68, 68, 0.6)';
    article.style.boxShadow = isDarkMode
      ? '0 0 0 1px rgba(248, 113, 113, 0.7), 0 14px 30px rgba(239, 68, 68, 0.18), 0 0 26px rgba(248, 113, 113, 0.24), 0 0 50px rgba(248, 113, 113, 0.12)'
      : '0 0 0 1px rgba(239, 68, 68, 0.45), 0 14px 30px rgba(239, 68, 68, 0.22), 0 0 26px rgba(248, 113, 113, 0.32), 0 0 50px rgba(248, 113, 113, 0.2)';
    return;
  }

  article.style.background = '';
  article.style.borderColor = '';
  article.style.boxShadow = '';
}

function handleSwipeMove(event) {
  if (isInteractiveTarget(event.target)) return;
  const article = event.target.closest('.action-item');
  if (!article || article.__dragStartX === undefined) return;

  const clientX = event.touches && event.touches[0] ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches && event.touches[0] ? event.touches[0].clientY : event.clientY;
  const deltaX = clientX - article.__dragStartX;
  const deltaY = clientY - (article.__dragStartY ?? clientY);

  if (Math.abs(deltaY) > 24 && Math.abs(deltaY) > Math.abs(deltaX)) {
    article.__swipeLocked = false;
    clearSwipeIntent(article);
    return;
  }

  if (Math.abs(deltaX) < 8) return;

  article.__swipeLocked = true;
  event.preventDefault();
  applySwipeVisual(article, deltaX);
}

function handleSwipeGestures(event) {
  if (isInteractiveTarget(event.target)) return;
  const article = event.target.closest('.action-item');
  if (!article || article.__dragStartX === undefined) return;

  const clientX = event.changedTouches && event.changedTouches[0] ? event.changedTouches[0].clientX : event.clientX;
  const id = article.dataset.id;
  const deltaX = clientX - article.__dragStartX;

  if (article.__swipeLocked && deltaX < -55) {
    toggleAction(id);
  } else if (article.__swipeLocked && deltaX > 55) {
    deleteAction(id);
  }

  clearSwipeIntent(article);
}

function setComposerExpanded(isExpanded) {
  if (!composerCard) return;
  const shouldExpand = Boolean(isExpanded);
  composerCard.classList.toggle('composer-collapsed', !shouldExpand);
  composerCard.classList.toggle('expanded', shouldExpand);
  composerCard.classList.toggle('focus-mode', shouldExpand);

  if (shouldExpand) {
    requestAnimationFrame(() => {
      composerCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      actionInput?.focus();
    });
  }
}

async function handleAuthSubmit() {
  if (!supabaseClient || !authEmailInput) return;

  const email = authEmailInput.value.trim();
  if (!email) {
    setAuthStatus('Enter your email');
    setAuthHint('Add the email address where you want to receive your one-time code.');
    return;
  }

  authSubmitButton.disabled = true;
  authSubmitButton.textContent = 'Sending...';
  setAuthStatus('Registering your sign-in request...');
  setAuthHint('Your request is registered. A one-time sign-in code should arrive in your email shortly.');

  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    authSubmitButton.disabled = false;
    authSubmitButton.textContent = 'Send code';
    setAuthStatus(error.message || 'Sign-in failed');
    setAuthHint('Something went wrong while registering your sign-in request. Please try again.');
    return;
  }

  authSubmitButton.disabled = false;
  authSubmitButton.textContent = 'Code sent';
  setAuthStatus('Request registered');
  setAuthHint('Your sign-in request is registered. Please check your inbox and spam folder for the one-time code.');
  authCodeInput?.focus();
}

async function handleAuthVerify() {
  if (!supabaseClient || !authEmailInput || !authCodeInput) return;

  const email = authEmailInput.value.trim();
  const token = authCodeInput.value.trim();

  if (!email) {
    setAuthStatus('Enter your email');
    setAuthHint('Add the email address that received your one-time code.');
    return;
  }

  if (!token) {
    setAuthStatus('Enter the code');
    setAuthHint('Type the code sent to your email.');
    return;
  }

  authVerifyButton.disabled = true;
  setAuthStatus('Verifying your sign-in code...');
  setAuthHint('Checking the one-time code and signing you in.');

  const { data, error } = await supabaseClient.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (error) {
    authVerifyButton.disabled = false;
    setAuthStatus(error.message || 'Verification failed');
    setAuthHint('That code did not work. Please request a new one and try again.');
    return;
  }

  authVerifyButton.disabled = false;
  currentUser = data?.user || data?.session?.user || null;
  authCodeInput.value = '';
  setAuthStatus(`Signed in as ${currentUser?.email || 'user'}`);
  setAuthHint('Your email was verified successfully.');
  setSyncStatus('Synced', true);
}

async function handleAuthSignOut() {
  if (!supabaseClient) return;

  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    setAuthStatus(error.message || 'Sign out failed');
    return;
  }

  currentUser = null;
  setAuthStatus('Not signed in');
  setAuthHint('Enter your email to receive a secure sign-in link.');
  setSyncStatus('Sign in required', false);
  renderActions();
}

async function initializeAuth() {
  if (!supabaseClient) {
    currentUser = null;
    setAuthStatus('Supabase is not configured');
    return;
  }

  const { data: { session }, error } = await supabaseClient.auth.getSession();
  if (error) {
    setAuthStatus(error.message || 'Could not load session');
    return;
  }

  currentUser = session?.user || null;
  if (currentUser) {
    setAuthStatus(`Signed in as ${currentUser.email || 'user'}`);
  } else {
    setAuthStatus('Not signed in');
    setSyncStatus('Sign in required', false);
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    if (currentUser) {
      setAuthStatus(`Signed in as ${currentUser.email || 'user'}`);
      setSyncStatus('Synced', true);
      pullActionsFromServer({ silent: false });
    } else {
      setAuthStatus('Not signed in');
      setSyncStatus('Sign in required', false);
      state.actions = [];
      renderActions();
    }
  });
}

function bindUI() {
  if (authSubmitButton) {
    authSubmitButton.addEventListener('click', handleAuthSubmit);
  }

  if (authVerifyButton) {
    authVerifyButton.addEventListener('click', handleAuthVerify);
  }

  if (authSignOutButton) {
    authSignOutButton.addEventListener('click', handleAuthSignOut);
  }

  window.addEventListener('focus', () => {
    pullActionsFromServer({ silent: true });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      pullActionsFromServer({ silent: true });
    }
  });

  composerExpandButton?.addEventListener('click', () => setComposerExpanded(true));
  actionInput?.addEventListener('focus', () => setComposerExpanded(true));
  notesInput?.addEventListener('focus', () => setComposerExpanded(true));

  darkModeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('pulse-notes-theme', isDark ? 'dark' : 'light');
    darkModeToggle.innerHTML = `<span>${isDark ? '☀️' : '🌙'}</span>`;
  });

  document.querySelectorAll('.category-pill').forEach((button) => {
    button.addEventListener('click', () => {
      selectedCategory = button.dataset.category;
      syncCategorySelection();
    });
  });

  document.querySelectorAll('[data-importance]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedImportance = Number(button.dataset.importance);
      syncImportanceSelection();
    });
  });

  document.querySelectorAll('[data-urgency]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedUrgency = Number(button.dataset.urgency);
      syncUrgencySelection();
    });
  });

  document.querySelectorAll('.filter-item').forEach((button) => {
    button.addEventListener('click', () => {
      currentFilter = button.dataset.filter;
      syncSummaryFilterSelection();
      renderActions();
    });
  });

  document.querySelectorAll('[data-category-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      currentCategoryFilter = button.dataset.categoryFilter;
      syncContextFilterSelection();
      renderActions();
    });
  });

  document.querySelectorAll('.view-tab').forEach((button) => {
    button.addEventListener('click', () => {
      currentView = button.dataset.view;
      document.querySelectorAll('.view-tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.view === currentView);
      });
      renderActions();
    });
  });

  document.querySelectorAll('.sort-tab').forEach((button) => {
    button.addEventListener('click', () => {
      currentSort = button.dataset.sort;
      document.querySelectorAll('.sort-tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.sort === currentSort);
      });
      renderActions();
    });
  });

  addActionButton.addEventListener('click', addAction);
  cancelActionButton?.addEventListener('click', cancelComposer);
  syncButton.addEventListener('click', syncActionsToServer);

  if (installButton) {
    installButton.addEventListener('click', async () => {
      if (!window.__pulseInstallPrompt) return;
      window.__pulseInstallPrompt.prompt();
      try {
        const choice = await window.__pulseInstallPrompt.userChoice;
        if (choice?.outcome === 'accepted') {
          installButton.hidden = true;
        }
      } catch (error) {
        console.warn('Install prompt aborted:', error);
      }
    });
  }

  actionList.addEventListener('click', handleActionListClick);
  actionList.addEventListener('submit', (event) => {
    const form = event.target.closest('.action-editor-form');
    if (!form) return;
    event.preventDefault();
    saveEditAction(form.dataset.editId);
  });
  actionList.addEventListener('keydown', (event) => {
    const form = event.target.closest('.action-editor-form');
    if (!form) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEditAction();
    }
  });
  actionList.addEventListener('touchstart', (event) => {
    if (isInteractiveTarget(event.target)) return;
    const article = event.target.closest('.action-item');
    if (!article) return;
    const touch = event.touches[0];
    article.__dragStartX = touch.clientX;
    article.__dragStartY = touch.clientY;
    article.__dragging = true;
    article.__swipeLocked = false;
    article.style.transition = 'none';
  }, { passive: true });

  actionList.addEventListener('touchmove', (event) => {
    if (isInteractiveTarget(event.target)) return;
    const article = event.target.closest('.action-item');
    if (!article || !article.__dragging) return;
    handleSwipeMove(event);
  }, { passive: false });

  actionList.addEventListener('touchend', handleSwipeGestures, { passive: true });
  actionList.addEventListener('touchcancel', handleSwipeGestures, { passive: true });

  actionList.addEventListener('pointerdown', (event) => {
    if (isInteractiveTarget(event.target)) return;
    const article = event.target.closest('.action-item');
    if (!article) return;
    article.__dragStartX = event.clientX;
    article.__dragStartY = event.clientY;
    article.__dragging = true;
    article.__swipeLocked = false;
    article.style.transition = 'none';
    article.setPointerCapture?.(event.pointerId);
  });

  actionList.addEventListener('pointermove', (event) => {
    if (isInteractiveTarget(event.target)) return;
    const article = event.target.closest('.action-item');
    if (!article || !article.__dragging) return;
    handleSwipeMove(event);
  });

  actionList.addEventListener('pointerup', handleSwipeGestures);
  actionList.addEventListener('pointercancel', handleSwipeGestures);

  actionInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      addAction();
    }
  });

  voiceButton.addEventListener('click', startVoiceCapture);
}

function startVoiceCapture() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert('Voice capture is not supported in this browser. You can still type actions manually.');
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.start();
  voiceButton.classList.add('listening');
  voiceButton.innerHTML = '<span>🎙</span>';

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const existing = actionInput.value.trim();
    actionInput.value = existing ? `${existing} ${transcript}` : transcript;
    actionInput.focus();
  };

  recognition.onend = () => {
    voiceButton.classList.remove('listening');
    voiceButton.innerHTML = '<span>🎙</span>';
  };

  recognition.onerror = () => {
    voiceButton.classList.remove('listening');
    voiceButton.innerHTML = '<span>🎙</span>';
  };
}

async function init() {
  const preferredTheme = localStorage.getItem('pulse-notes-theme');
  const shouldUseDark = preferredTheme === 'dark';
  const syncState = getSyncState();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    window.__pulseInstallPrompt = event;
    if (installButton) {
      installButton.hidden = false;
    }
  });

  if (window.matchMedia('(display-mode: standalone)').matches && installButton) {
    installButton.hidden = true;
  }

  if (shouldUseDark) {
    document.body.classList.add('dark-mode');
    darkModeToggle.innerHTML = '<span>☀️</span>';
  } else {
    darkModeToggle.innerHTML = '<span>🌙</span>';
  }

  setComposerExpanded(false);

  await initializeAuth();

  if (syncState.status === 'synced') {
    setSyncStatus('Synced', true);
  } else if (supabaseClient && !currentUser) {
    setSyncStatus('Sign in required', false);
  } else {
    setSyncStatus('Offline', false);
  }

  syncCategorySelection();
  syncContextFilterSelection();
  syncSummaryFilterSelection();
  syncImportanceSelection();
  syncUrgencySelection();
  bindUI();
  renderActions();
  if (currentUser) {
    await pullActionsFromServer();
  }
}

init();
})();
}
