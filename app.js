/* Prompt Board — Prompt-Ablage mit Kategorien, Farbrahmen und Schloss pro Kachel.
   Alle Daten liegen lokal im Browser (localStorage). */

const STORE_KEY   = 'promptai.board.v2';
const BACKUP_KEY  = 'promptai.board.v2.bak';
const META_KEY    = 'promptai.meta.v2';
const LEGACY_KEY  = 'promptai.prompts.v1';
const EXPORT_WARN_DAYS = 7;

/* 10 gut unterscheidbare Rahmenfarben */
const COLORS = [
  { key: 'rot',     hex: '#ff5f56', label: 'Rot' },
  { key: 'orange',  hex: '#ff9f2e', label: 'Orange' },
  { key: 'gelb',    hex: '#ffd93d', label: 'Gelb' },
  { key: 'gruen',   hex: '#4ade80', label: 'Grün' },
  { key: 'tuerkis', hex: '#2dd4bf', label: 'Türkis' },
  { key: 'blau',    hex: '#4f8cff', label: 'Blau' },
  { key: 'violett', hex: '#a78bfa', label: 'Violett' },
  { key: 'pink',    hex: '#f472b6', label: 'Pink' },
  { key: 'braun',   hex: '#c08457', label: 'Braun' },
  { key: 'grau',    hex: '#94a3b8', label: 'Grau' },
];
const COLOR_KEYS = COLORS.map(c => c.key);
const colorHex = (key) => (COLORS.find(c => c.key === key) || {}).hex || null;

const PRESETS = [
  'Börse & Aktien', 'App-Entwicklung', 'Spiele-Entwicklung', 'Marktrecherche',
  'Gesundheit & Analyse', 'Recherche & Web', 'Text & Content', 'Daten & Auswertung',
];

const $ = (id) => document.getElementById(id);

const el = {
  board: $('board'), empty: $('empty'), count: $('count'), search: $('search'),
  manageBtn: $('manageBtn'), importBtn: $('importBtn'), exportBtn: $('exportBtn'),
  importFile: $('importFile'), lockAllBtn: $('lockAllBtn'), lockAllCount: $('lockAllCount'),
  storageBar: $('storageBar'), storageText: $('storageText'), storageAction: $('storageAction'),
  quickForm: $('quickForm'), qTitle: $('qTitle'), qBody: $('qBody'), qCat: $('qCat'), qColors: $('qColors'),
  viewOverlay: $('viewOverlay'), viewTitle: $('viewTitle'), viewChips: $('viewChips'),
  viewBody: $('viewBody'), viewMeta: $('viewMeta'), viewCopy: $('viewCopy'),
  viewEdit: $('viewEdit'), viewLock: $('viewLock'), viewClose: $('viewClose'),
  editOverlay: $('editOverlay'), editForm: $('editForm'), editHeading: $('editHeading'),
  fTitle: $('fTitle'), fBody: $('fBody'), fCat: $('fCat'), fColors: $('fColors'),
  deleteBtn: $('deleteBtn'), cancelBtn: $('cancelBtn'), editClose: $('editClose'),
  manageOverlay: $('manageOverlay'), manageClose: $('manageClose'),
  catList: $('catList'), catAddForm: $('catAddForm'), catName: $('catName'), presets: $('presets'),
  assignSearch: $('assignSearch'), assignTarget: $('assignTarget'), assignBtn: $('assignBtn'),
  assignList: $('assignList'), assignAll: $('assignAll'), assignCount: $('assignCount'),
  palette: $('palette'), toast: $('toast'),
};

let state = { version: 2, categories: [], prompts: [] };
let meta  = { lastExport: 0, changes: 0 };

/* Entsperrte Kacheln gelten nur für diese Sitzung — ein Neuladen sperrt alles wieder. */
const unlocked = new Set();

let canStore = true;
let openId = null;      // Prompt im Ansicht-Fenster
let editId = null;      // Prompt im Bearbeiten-Fenster
let qColor = null;      // Farbwahl der Schnell-Leiste
let fColor = null;      // Farbwahl im Bearbeiten-Fenster
const selected = new Set();   // Auswahl im Verwaltungs-Fenster

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/* ---------------- Storage ---------------- */

function probeStorage() {
  try {
    localStorage.setItem('promptai.probe', '1');
    localStorage.removeItem('promptai.probe');
    return true;
  } catch { return false; }
}

function normalize(raw) {
  const out = { version: 2, categories: [], prompts: [] };
  const cats = Array.isArray(raw && raw.categories) ? raw.categories : [];
  out.categories = cats
    .filter(c => c && typeof c.name === 'string')
    .map((c, i) => ({
      id: typeof c.id === 'string' ? c.id : uid(),
      name: c.name.slice(0, 40),
      color: COLOR_KEYS.includes(c.color) ? c.color : COLOR_KEYS[i % COLOR_KEYS.length],
      collapsed: !!c.collapsed,
      created: Number(c.created) || Date.now(),
    }));

  const known = new Set(out.categories.map(c => c.id));
  const list = Array.isArray(raw && raw.prompts) ? raw.prompts : (Array.isArray(raw) ? raw : []);
  out.prompts = list
    .filter(p => p && typeof p.title === 'string' && typeof p.body === 'string')
    .map(p => ({
      id: typeof p.id === 'string' ? p.id : uid(),
      title: p.title.slice(0, 80),
      body: p.body,
      categoryId: known.has(p.categoryId) ? p.categoryId : null,
      color: COLOR_KEYS.includes(p.color) ? p.color : null,
      created: Number(p.created) || Date.now(),
      updated: Number(p.updated) || Date.now(),
    }));

  // Doppelte IDs entschärfen, sonst greifen Bearbeiten und Löschen daneben.
  const seen = new Set();
  out.prompts.forEach(p => { if (seen.has(p.id)) p.id = uid(); seen.add(p.id); });
  return out;
}

function load() {
  canStore = probeStorage();
  if (!canStore) { state = normalize({ prompts: seed() }); return; }

  const raw = localStorage.getItem(STORE_KEY);
  if (raw) {
    try { state = normalize(JSON.parse(raw)); }
    catch { state = recoverFromBackup(); }
  } else {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      try { state = normalize({ prompts: JSON.parse(legacy) }); toast('Bestehende Prompts übernommen'); }
      catch { state = normalize({ prompts: seed() }); }
    } else {
      state = normalize({ prompts: seed() });
    }
    save();
  }

  try { meta = Object.assign(meta, JSON.parse(localStorage.getItem(META_KEY) || '{}')); } catch { /* egal */ }
}

function recoverFromBackup() {
  try {
    const bak = localStorage.getItem(BACKUP_KEY);
    if (bak) { toast('Daten waren beschädigt — Sicherung geladen', true); return normalize(JSON.parse(bak)); }
  } catch { /* fällt unten durch */ }
  toast('Gespeicherte Daten konnten nicht gelesen werden', true);
  return { version: 2, categories: [], prompts: [] };
}

function save() {
  meta.changes = (meta.changes || 0) + 1;
  if (!canStore) { renderStorage(); return; }
  try {
    const prev = localStorage.getItem(STORE_KEY);
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    if (prev && prev.length > 2) localStorage.setItem(BACKUP_KEY, prev);
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    toast('Speichern fehlgeschlagen — Browser-Speicher voll?', true);
  }
  renderStorage();
}

function seed() {
  return [{
    id: uid(),
    title: 'Beispiel: Game-Prompt Generator',
    body:
`Du bist ein Prompt-Architekt für Claude Code.

Ziel: Aus meiner groben Spielidee einen präzisen, umsetzbaren Entwicklungs-Prompt bauen.

Frage mich zuerst nach allem, was fehlt, und erstelle danach einen Prompt, der folgende Punkte exakt festlegt:
1. Spielkonzept in einem Satz (Genre, Kernschleife, Zielgruppe)
2. Tech-Stack (Sprache, Engine/Framework, Build-Setup, Zielplattform)
3. Feature-Liste, aufgeteilt in MVP und Später
4. Spielmechanik im Detail (Steuerung, Regeln, Siegbedingung, Schwierigkeitskurve)
5. Datenmodell und Projektstruktur (Ordner, Dateien, Verantwortlichkeiten)
6. Grafik/Audio: Stil, Assets, Platzhalter-Strategie
7. Definition of Done und Testkriterien
8. Explizite Nicht-Ziele (was NICHT gebaut wird)

Ausgabeformat: ein einziger, kopierfertiger Prompt in Markdown mit klaren Abschnitten,
ohne Rückfragen, ohne Meta-Kommentare, direkt an Claude Code adressiert.`,
    created: Date.now(),
    updated: Date.now(),
  }];
}

/* ---------------- Speicher-Statuszeile ---------------- */

function renderStorage() {
  el.storageBar.classList.remove('warn', 'danger');

  if (!canStore) {
    el.storageBar.classList.add('danger');
    el.storageText.textContent =
      '⚠ Dieser Browser speichert nichts (privater Modus?). Änderungen sind nach dem Schliessen weg — bitte exportieren.';
    el.storageAction.hidden = false;
    return;
  }

  const days = meta.lastExport ? Math.floor((Date.now() - meta.lastExport) / 86400000) : null;
  const backup = days === null
    ? 'noch nie exportiert'
    : days === 0 ? 'heute exportiert' : `letzter Export vor ${days} Tag${days === 1 ? '' : 'en'}`;

  el.storageText.textContent =
    `💾 Automatisch gespeichert — nur in diesem Browser auf diesem Gerät · ${backup}`;

  const stale = (days === null || days >= EXPORT_WARN_DAYS) && state.prompts.length > 0;
  if (stale) el.storageBar.classList.add('warn');
  el.storageAction.hidden = !stale;
}

/* ---------------- Farb-Auswahl ---------------- */

function buildSwatches(container, current, onPick, opts = {}) {
  container.innerHTML = '';
  if (opts.auto !== false) {
    const auto = document.createElement('button');
    auto.type = 'button';
    auto.className = 'sw sw-auto' + (current ? '' : ' on');
    auto.title = opts.autoLabel || 'Farbe der Kategorie übernehmen';
    auto.textContent = '∅';
    auto.addEventListener('click', () => onPick(null));
    container.appendChild(auto);
  }
  COLORS.forEach(c => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sw' + (current === c.key ? ' on' : '');
    b.style.background = c.hex;
    b.title = c.label;
    b.setAttribute('aria-label', c.label);
    b.addEventListener('click', () => onPick(c.key));
    container.appendChild(b);
  });
}

let paletteAnchor = null;

function showPalette(anchor, current, onPick, opts = {}) {
  paletteAnchor = anchor;
  buildSwatches(el.palette, current, (key) => { hidePalette(); onPick(key); }, opts);
  el.palette.hidden = false;

  const r = anchor.getBoundingClientRect();
  const w = el.palette.offsetWidth, h = el.palette.offsetHeight;
  const left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - w - 8));
  let top = r.bottom + 6;
  if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
  el.palette.style.left = `${left}px`;
  el.palette.style.top = `${top}px`;
}

function hidePalette() { el.palette.hidden = true; paletteAnchor = null; }

document.addEventListener('pointerdown', (e) => {
  if (el.palette.hidden) return;
  if (e.target.closest('.palette') || e.target === paletteAnchor) return;
  hidePalette();
}, true);
window.addEventListener('resize', hidePalette);

/* ---------------- Kategorien ---------------- */

const catById = (id) => state.categories.find(c => c.id === id) || null;

function nextCatColor() {
  const used = state.categories.map(c => c.color);
  return COLOR_KEYS.find(k => !used.includes(k)) || COLOR_KEYS[state.categories.length % COLOR_KEYS.length];
}

function addCategory(name) {
  const clean = name.trim().slice(0, 40);
  if (!clean) return null;
  if (state.categories.some(c => c.name.toLowerCase() === clean.toLowerCase())) {
    toast('Kategorie gibt es schon', true);
    return null;
  }
  const cat = { id: uid(), name: clean, color: nextCatColor(), collapsed: false, created: Date.now() };
  state.categories.push(cat);
  save(); render(); renderManage();
  return cat;
}

function deleteCategory(id) {
  const cat = catById(id);
  if (!cat) return;
  const n = state.prompts.filter(p => p.categoryId === id).length;
  const extra = n ? `\n\n${n} Prompt${n === 1 ? '' : 's'} wandern nach „Ohne Kategorie" — gelöscht wird nichts.` : '';
  if (!confirm(`Kategorie „${cat.name}" löschen?${extra}`)) return;
  state.prompts.forEach(p => { if (p.categoryId === id) p.categoryId = null; });
  state.categories = state.categories.filter(c => c.id !== id);
  save(); render(); renderManage();
  toast('Kategorie gelöscht');
}

function moveCategory(id, delta) {
  const i = state.categories.findIndex(c => c.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= state.categories.length) return;
  const [c] = state.categories.splice(i, 1);
  state.categories.splice(j, 0, c);
  save(); render(); renderManage();
}

function fillCatSelect(sel, value, allLabel) {
  sel.innerHTML = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = allLabel || 'Ohne Kategorie';
  sel.appendChild(none);
  state.categories.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.name;
    sel.appendChild(o);
  });
  sel.value = value || '';
}

/* ---------------- Prompts ---------------- */

const promptById = (id) => state.prompts.find(p => p.id === id) || null;

function effectiveColor(p) {
  if (p.color) return colorHex(p.color);
  const cat = catById(p.categoryId);
  return cat ? colorHex(cat.color) : null;
}

function movePrompt(id, targetCatId, beforeId = null) {
  const i = state.prompts.findIndex(p => p.id === id);
  if (i < 0) return;
  const [p] = state.prompts.splice(i, 1);
  const changedCat = (p.categoryId || null) !== (targetCatId || null);
  p.categoryId = targetCatId || null;
  if (changedCat) p.updated = Date.now();

  if (beforeId) {
    const j = state.prompts.findIndex(x => x.id === beforeId);
    state.prompts.splice(j < 0 ? state.prompts.length : j, 0, p);
  } else {
    let last = -1;
    state.prompts.forEach((x, idx) => { if ((x.categoryId || null) === (targetCatId || null)) last = idx; });
    state.prompts.splice(last + 1, 0, p);
  }
  save(); render();
}

/* ---------------- Board ---------------- */

function matches(p, q) {
  if (!q) return true;
  if (p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q)) return true;
  const cat = catById(p.categoryId);
  return !!cat && cat.name.toLowerCase().includes(q);
}

function render() {
  const q = el.search.value.trim().toLowerCase();
  fillCatSelect(el.qCat, el.qCat.value);   // Schnell-Leiste kennt neue Kategorien sofort
  el.board.innerHTML = '';

  const groups = state.categories.map(c => ({ id: c.id, name: c.name, color: colorHex(c.color), cat: c }));
  groups.push({
    id: null,
    name: state.categories.length ? 'Ohne Kategorie' : 'Alle Prompts',
    color: null,
    cat: null,
  });

  let shown = 0;
  groups.forEach(g => {
    const items = state.prompts.filter(p => (p.categoryId || null) === g.id && matches(p, q));
    if (g.id === null && items.length === 0) return;      // leere Restgruppe nicht zeigen
    if (q && items.length === 0) return;                  // bei Suche nur Treffer-Gruppen
    shown += items.length;
    el.board.appendChild(sectionEl(g, items, q));
  });

  el.empty.hidden = shown > 0;
  if (shown === 0) {
    const t = el.empty.querySelector('.empty-title');
    const s = el.empty.querySelector('p:last-child');
    if (q) {
      t.textContent = 'Kein Treffer';
      s.textContent = `Keine Prompts für „${el.search.value}".`;
    } else {
      t.textContent = 'Noch keine Prompts';
      s.innerHTML = 'Titel und Prompt-Text oben in die Leiste eintragen und auf <strong>+ Anlegen</strong> klicken.';
    }
  }

  const n = state.prompts.length;
  const c = state.categories.length;
  el.count.textContent = `${n} ${n === 1 ? 'Prompt' : 'Prompts'}` + (c ? ` · ${c} Kategorien` : '');

  renderLockAll();
}

function sectionEl(g, items, q) {
  const sec = document.createElement('section');
  sec.className = 'cat';
  sec.dataset.cat = g.id || '';
  if (g.color) sec.style.setProperty('--cat-color', g.color);
  sec.classList.toggle('plain', !g.color);

  const collapsed = !!(g.cat && g.cat.collapsed) && !q;
  sec.classList.toggle('collapsed', collapsed);

  const head = document.createElement('div');
  head.className = 'cat-head';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'cat-toggle';
  toggle.textContent = collapsed ? '▸' : '▾';
  toggle.title = collapsed ? 'Aufklappen' : 'Zuklappen';
  toggle.addEventListener('click', () => {
    if (!g.cat) { sec.classList.toggle('collapsed'); toggle.textContent = sec.classList.contains('collapsed') ? '▸' : '▾'; return; }
    g.cat.collapsed = !g.cat.collapsed;
    save(); render();
  });

  const name = document.createElement('h2');
  name.className = 'cat-name';
  name.textContent = g.name;

  const count = document.createElement('span');
  count.className = 'cat-count';
  count.textContent = items.length;

  const actions = document.createElement('span');
  actions.className = 'cat-actions';

  const addHere = document.createElement('button');
  addHere.type = 'button';
  addHere.className = 'mini';
  addHere.textContent = '+ Prompt';
  addHere.title = 'Neuen Prompt in dieser Kategorie anlegen';
  addHere.addEventListener('click', () => {
    el.qCat.value = g.id || '';
    el.qTitle.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  actions.appendChild(addHere);

  if (g.cat) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'mini';
    dot.textContent = '🎨';
    dot.title = 'Farbe der Kategorie';
    dot.addEventListener('click', () => {
      showPalette(dot, g.cat.color, (key) => {
        if (!key) return;
        g.cat.color = key;
        save(); render(); renderManage();
      }, { auto: false });
    });
    actions.appendChild(dot);
  }

  head.append(toggle, name, count, actions);

  const grid = document.createElement('div');
  grid.className = 'grid';
  items.forEach(p => grid.appendChild(cardEl(p)));

  sec.append(head, grid);
  attachSectionDrop(sec, g.id);
  return sec;
}

function cardEl(p) {
  const open = unlocked.has(p.id);
  const color = effectiveColor(p);

  const card = document.createElement('article');
  card.className = 'card' + (open ? ' open' : '');
  card.dataset.id = p.id;
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  if (color) { card.style.setProperty('--card-color', color); card.classList.add('has-color'); }
  card.draggable = open;

  const lock = document.createElement('button');
  lock.type = 'button';
  lock.className = 'card-lock';
  lock.textContent = open ? '🔓' : '🔒';
  lock.title = open ? 'Diese Kachel wieder sperren' : 'Diese Kachel zum Bearbeiten entsperren';
  lock.setAttribute('aria-pressed', String(open));
  lock.addEventListener('click', (e) => {
    e.stopPropagation();
    if (open) unlocked.delete(p.id); else unlocked.add(p.id);
    render();
  });

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = p.title;

  const preview = document.createElement('div');
  preview.className = 'card-preview';
  preview.textContent = p.body.replace(/\s+/g, ' ').slice(0, 120);

  const foot = document.createElement('div');
  foot.className = 'card-foot';

  const metaSpan = document.createElement('span');
  metaSpan.textContent = `${p.body.length} Zeichen`;
  foot.appendChild(metaSpan);

  const actions = document.createElement('span');
  actions.className = 'card-actions';

  actions.appendChild(miniBtn('📋', 'Prompt kopieren', (e) => { e.stopPropagation(); copyText(p.body); }));

  if (open) {
    actions.appendChild(miniBtn('✎', 'Bearbeiten', (e) => { e.stopPropagation(); openEdit(p.id); }));

    const paint = miniBtn('🎨', 'Rahmenfarbe', (e) => {
      e.stopPropagation();
      showPalette(paint, p.color, (key) => { p.color = key; p.updated = Date.now(); save(); render(); });
    });
    actions.appendChild(paint);

    actions.appendChild(miniBtn('🗑', 'Löschen', (e) => { e.stopPropagation(); removePrompt(p.id); }));

    const handle = document.createElement('span');
    handle.className = 'mini drag-handle';
    handle.textContent = '⠿';
    handle.title = 'Zum Sortieren oder in eine andere Kategorie ziehen';
    actions.appendChild(handle);
  }

  foot.appendChild(actions);
  card.append(lock, title, preview, foot);

  card.addEventListener('click', () => openView(p.id));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openView(p.id); }
  });

  attachCardDrag(card);
  return card;
}

function miniBtn(text, title, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'mini';
  b.textContent = text;
  b.title = title;
  b.addEventListener('click', onClick);
  return b;
}

function renderLockAll() {
  el.lockAllBtn.hidden = unlocked.size === 0;
  el.lockAllCount.textContent = unlocked.size ? `(${unlocked.size})` : '';
}

function removePrompt(id) {
  const p = promptById(id);
  if (!p) return;
  if (!confirm(`„${p.title}" wirklich löschen?`)) return;
  state.prompts = state.prompts.filter(x => x.id !== id);
  unlocked.delete(id);
  selected.delete(id);
  save();
  if (openId === id) closeView();
  if (editId === id) closeEdit();
  render(); renderManage();
  toast('Gelöscht');
}

/* ---------------- Drag & Drop ---------------- */

let dragId = null;

function attachCardDrag(card) {
  card.addEventListener('dragstart', (e) => {
    if (!card.draggable) return;
    dragId = card.dataset.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
  });
  card.addEventListener('dragend', () => {
    dragId = null;
    card.classList.remove('dragging');
    document.querySelectorAll('.drop-target').forEach(n => n.classList.remove('drop-target'));
    document.querySelectorAll('.cat.drop-into').forEach(n => n.classList.remove('drop-into'));
  });
  card.addEventListener('dragover', (e) => {
    if (!dragId || dragId === card.dataset.id) return;
    e.preventDefault();
    e.stopPropagation();
    card.classList.add('drop-target');
  });
  card.addEventListener('dragleave', () => card.classList.remove('drop-target'));
  card.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    card.classList.remove('drop-target');
    if (!dragId || dragId === card.dataset.id) return;
    const target = promptById(card.dataset.id);
    if (!target) return;
    movePrompt(dragId, target.categoryId, target.id);
  });
}

function attachSectionDrop(sec, catId) {
  sec.addEventListener('dragover', (e) => {
    if (!dragId) return;
    e.preventDefault();
    sec.classList.add('drop-into');
  });
  sec.addEventListener('dragleave', (e) => {
    if (!sec.contains(e.relatedTarget)) sec.classList.remove('drop-into');
  });
  sec.addEventListener('drop', (e) => {
    e.preventDefault();
    sec.classList.remove('drop-into');
    if (!dragId) return;
    movePrompt(dragId, catId);
  });
}

/* ---------------- Ansicht ---------------- */

function openView(id) {
  const p = promptById(id);
  if (!p) return;
  openId = id;
  el.viewTitle.textContent = p.title;

  el.viewChips.innerHTML = '';
  const cat = catById(p.categoryId);
  if (cat) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.style.setProperty('--chip-color', colorHex(cat.color));
    chip.textContent = cat.name;
    el.viewChips.appendChild(chip);
  }
  if (unlocked.has(id)) {
    const chip = document.createElement('span');
    chip.className = 'chip chip-open';
    chip.textContent = '🔓 entsperrt';
    el.viewChips.appendChild(chip);
  }

  el.viewBody.textContent = p.body;
  el.viewMeta.textContent =
    `${p.body.length} Zeichen · zuletzt geändert ${new Date(p.updated).toLocaleDateString('de-CH')}`;

  const open = unlocked.has(id);
  el.viewEdit.hidden = !open;
  el.viewLock.textContent = open ? '🔓' : '🔒';

  el.viewOverlay.hidden = false;
  el.viewCopy.focus();
}

function closeView() { el.viewOverlay.hidden = true; openId = null; }

/* ---------------- Bearbeiten ---------------- */

function openEdit(id) {
  const p = promptById(id);
  if (!p || !unlocked.has(id)) return;
  editId = id;
  fColor = p.color;
  el.editHeading.textContent = 'Prompt bearbeiten';
  el.fTitle.value = p.title;
  el.fBody.value = p.body;
  fillCatSelect(el.fCat, p.categoryId);
  renderEditSwatches();
  el.editOverlay.hidden = false;
  el.fTitle.focus();
}

function renderEditSwatches() {
  buildSwatches(el.fColors, fColor, (key) => { fColor = key; renderEditSwatches(); });
}

function closeEdit() { el.editOverlay.hidden = true; editId = null; }

el.editForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const p = promptById(editId);
  if (!p) return;
  const title = el.fTitle.value.trim();
  const body = el.fBody.value.trim();
  if (!title || !body) return;

  const newCat = el.fCat.value || null;
  const catChanged = (p.categoryId || null) !== newCat;
  p.title = title;
  p.body = body;
  p.color = fColor;
  p.updated = Date.now();

  if (catChanged) movePrompt(p.id, newCat);
  else { save(); render(); }

  closeEdit();
  closeView();
  renderManage();
  toast('Gespeichert');
});

el.deleteBtn.addEventListener('click', () => removePrompt(editId));

/* ---------------- Schnell-Leiste ---------------- */

function renderQuickSwatches() {
  buildSwatches(el.qColors, qColor, (key) => { qColor = key; renderQuickSwatches(); });
}

function autogrow(ta) {
  ta.style.height = 'auto';
  ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;
}

el.quickForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = el.qTitle.value.trim();
  const body = el.qBody.value.trim();
  if (!title || !body) return;

  const p = {
    id: uid(),
    title,
    body,
    categoryId: el.qCat.value || null,
    color: qColor,
    created: Date.now(),
    updated: Date.now(),
  };

  // Neuer Prompt landet am Anfang seiner Kategorie.
  const first = state.prompts.findIndex(x => (x.categoryId || null) === p.categoryId);
  if (first < 0) state.prompts.push(p); else state.prompts.splice(first, 0, p);

  save();
  el.qTitle.value = '';
  el.qBody.value = '';
  autogrow(el.qBody);
  render(); renderManage();
  el.qTitle.focus();
  toast('Prompt angelegt ✓');
});

el.qBody.addEventListener('input', () => autogrow(el.qBody));
el.qBody.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); el.quickForm.requestSubmit(); }
});

/* ---------------- Verwaltungs-Fenster ---------------- */

function openManage() {
  el.manageOverlay.hidden = false;
  renderManage();
  el.catName.focus();
}
function closeManage() { el.manageOverlay.hidden = true; }

function renderManage() {
  if (el.manageOverlay.hidden) return;
  renderCatList();
  renderAssign();
}

function renderCatList() {
  el.catList.innerHTML = '';

  if (!state.categories.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'Noch keine Kategorien. Unten anlegen oder eine Vorlage anklicken.';
    el.catList.appendChild(p);
  }

  state.categories.forEach((c, i) => {
    const row = document.createElement('div');
    row.className = 'cat-row';
    row.style.setProperty('--cat-color', colorHex(c.color));

    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'cat-dot';
    dot.title = 'Farbe wählen';
    dot.addEventListener('click', () => {
      showPalette(dot, c.color, (key) => { if (!key) return; c.color = key; save(); render(); renderCatList(); }, { auto: false });
    });

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'cat-input';
    input.value = c.name;
    input.maxLength = 40;
    input.title = 'Name ändern';
    const commit = () => {
      const v = input.value.trim().slice(0, 40);
      if (!v || v === c.name) { input.value = c.name; return; }
      if (state.categories.some(x => x !== c && x.name.toLowerCase() === v.toLowerCase())) {
        toast('Name schon vergeben', true); input.value = c.name; return;
      }
      c.name = v; save(); render(); renderAssign();
    };
    input.addEventListener('change', commit);
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });

    const n = state.prompts.filter(p => p.categoryId === c.id).length;
    const count = document.createElement('span');
    count.className = 'cat-count';
    count.textContent = n;

    const up = miniBtn('↑', 'Nach oben', () => moveCategory(c.id, -1));
    up.disabled = i === 0;
    const down = miniBtn('↓', 'Nach unten', () => moveCategory(c.id, +1));
    down.disabled = i === state.categories.length - 1;
    const del = miniBtn('🗑', 'Kategorie löschen', () => deleteCategory(c.id));
    del.classList.add('mini-danger');

    row.append(dot, input, count, up, down, del);
    el.catList.appendChild(row);
  });

  el.presets.innerHTML = '';
  PRESETS.forEach(name => {
    const exists = state.categories.some(c => c.name.toLowerCase() === name.toLowerCase());
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip chip-btn';
    b.textContent = exists ? `✓ ${name}` : `+ ${name}`;
    b.disabled = exists;
    b.addEventListener('click', () => addCategory(name));
    el.presets.appendChild(b);
  });
}

function renderAssign() {
  const q = el.assignSearch.value.trim().toLowerCase();
  const target = el.assignTarget.value;
  fillCatSelect(el.assignTarget, target, '→ Ohne Kategorie');

  el.assignList.innerHTML = '';
  const list = state.prompts.filter(p => !q || p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q));

  if (!list.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = q ? 'Kein Treffer.' : 'Noch keine Prompts.';
    el.assignList.appendChild(p);
  }

  list.forEach(p => {
    const row = document.createElement('label');
    row.className = 'assign-row';
    const color = effectiveColor(p);
    if (color) row.style.setProperty('--row-color', color);

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = selected.has(p.id);
    cb.addEventListener('change', () => {
      if (cb.checked) selected.add(p.id); else selected.delete(p.id);
      updateAssignCount();
    });

    const txt = document.createElement('span');
    txt.className = 'assign-title';
    txt.textContent = p.title;

    const cat = catById(p.categoryId);
    const tag = document.createElement('span');
    tag.className = 'assign-cat';
    tag.textContent = cat ? cat.name : 'Ohne Kategorie';

    row.append(cb, txt, tag);
    el.assignList.appendChild(row);
  });

  updateAssignCount();
}

function updateAssignCount() {
  el.assignCount.textContent = selected.size ? `${selected.size} ausgewählt` : 'nichts ausgewählt';
  el.assignBtn.disabled = selected.size === 0;
}

el.assignBtn.addEventListener('click', () => {
  if (!selected.size) return;
  const target = el.assignTarget.value || null;
  [...selected].forEach(id => movePrompt(id, target));
  const n = selected.size;
  selected.clear();
  el.assignAll.checked = false;
  renderManage();
  toast(`${n} Prompt${n === 1 ? '' : 's'} verschoben`);
});

el.assignAll.addEventListener('change', () => {
  const q = el.assignSearch.value.trim().toLowerCase();
  const list = state.prompts.filter(p => !q || p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q));
  list.forEach(p => { if (el.assignAll.checked) selected.add(p.id); else selected.delete(p.id); });
  renderAssign();
});

el.assignSearch.addEventListener('input', renderAssign);

el.catAddForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (addCategory(el.catName.value)) { el.catName.value = ''; el.catName.focus(); }
});

/* ---------------- Kopieren ---------------- */

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Prompt kopiert ✓');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    toast(ok ? 'Prompt kopiert ✓' : 'Kopieren nicht möglich', !ok);
  }
}

let toastTimer;
function toast(msg, isError = false) {
  el.toast.textContent = msg;
  el.toast.classList.toggle('err', isError);
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, 1800);
}

/* ---------------- Export / Import ---------------- */

function exportAll() {
  const payload = {
    app: 'promptai',
    version: 2,
    exported: new Date().toISOString(),
    categories: state.categories,
    prompts: state.prompts,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `prompt-board-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);

  meta.lastExport = Date.now();
  meta.changes = 0;
  if (canStore) { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch { /* egal */ } }
  renderStorage();
}

el.exportBtn.addEventListener('click', exportAll);
el.storageAction.addEventListener('click', exportAll);
el.importBtn.addEventListener('click', () => el.importFile.click());

el.importFile.addEventListener('change', async () => {
  const file = el.importFile.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incoming = normalize(data);
    if (!incoming.prompts.length) throw new Error('leer');

    // Kategorien über den Namen zusammenführen, damit kein Duplikat entsteht.
    const map = new Map();
    incoming.categories.forEach(c => {
      const hit = state.categories.find(x => x.name.toLowerCase() === c.name.toLowerCase());
      if (hit) { map.set(c.id, hit.id); return; }
      const fresh = { id: uid(), name: c.name, color: c.color, collapsed: false, created: Date.now() };
      state.categories.push(fresh);
      map.set(c.id, fresh.id);
    });

    let added = 0, skipped = 0;
    incoming.prompts.forEach(p => {
      const dup = state.prompts.some(x => x.title === p.title && x.body === p.body);
      if (dup) { skipped++; return; }
      state.prompts.push({
        ...p,
        id: uid(),
        categoryId: p.categoryId ? (map.get(p.categoryId) || null) : null,
      });
      added++;
    });

    save(); render(); renderManage();
    toast(`${added} importiert${skipped ? `, ${skipped} Duplikate übersprungen` : ''}`);
  } catch {
    toast('Datei konnte nicht gelesen werden', true);
  }
  el.importFile.value = '';
});

/* ---------------- Events ---------------- */

el.search.addEventListener('input', render);
el.manageBtn.addEventListener('click', openManage);
el.manageClose.addEventListener('click', closeManage);

el.lockAllBtn.addEventListener('click', () => {
  unlocked.clear();
  closeEdit();
  render();
  toast('Alle Kacheln gesperrt 🔒');
});

el.viewCopy.addEventListener('click', () => {
  const p = promptById(openId);
  if (p) copyText(p.body);
});
el.viewEdit.addEventListener('click', () => openEdit(openId));
el.viewLock.addEventListener('click', () => {
  if (!openId) return;
  if (unlocked.has(openId)) unlocked.delete(openId); else unlocked.add(openId);
  render();
  openView(openId);
});
el.viewClose.addEventListener('click', closeView);
el.cancelBtn.addEventListener('click', closeEdit);
el.editClose.addEventListener('click', closeEdit);

el.viewOverlay.addEventListener('click', (e) => { if (e.target === el.viewOverlay) closeView(); });
el.editOverlay.addEventListener('click', (e) => { if (e.target === el.editOverlay) closeEdit(); });
el.manageOverlay.addEventListener('click', (e) => { if (e.target === el.manageOverlay) closeManage(); });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!el.palette.hidden) hidePalette();
    else if (!el.editOverlay.hidden) closeEdit();
    else if (!el.manageOverlay.hidden) closeManage();
    else if (!el.viewOverlay.hidden) closeView();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !el.editOverlay.hidden) {
    el.editForm.requestSubmit();
  }
});

// Warnen, wenn beim Verlassen noch nie gesichert wurde und der Browser nichts speichert.
window.addEventListener('beforeunload', (e) => {
  if (canStore || state.prompts.length === 0) return;
  e.preventDefault();
  e.returnValue = '';
});

/* ---------------- Start ---------------- */

load();
fillCatSelect(el.qCat, '');
renderQuickSwatches();
renderStorage();
render();
autogrow(el.qBody);
