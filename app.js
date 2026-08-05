/* Prompt Board — einfache Prompt-Ablage mit Grid, Lock und Copy-Button.
   Alle Daten liegen lokal im Browser (localStorage). */

const STORAGE_KEY = 'promptai.prompts.v1';
const LOCK_KEY = 'promptai.locked.v1';

const $ = (id) => document.getElementById(id);

const el = {
  grid: $('grid'),
  empty: $('empty'),
  count: $('count'),
  search: $('search'),
  addBtn: $('addBtn'),
  importBtn: $('importBtn'),
  exportBtn: $('exportBtn'),
  importFile: $('importFile'),
  lockBtn: $('lockBtn'),
  lockIcon: $('lockIcon'),
  lockText: $('lockText'),
  viewOverlay: $('viewOverlay'),
  viewTitle: $('viewTitle'),
  viewBody: $('viewBody'),
  viewMeta: $('viewMeta'),
  viewCopy: $('viewCopy'),
  viewEdit: $('viewEdit'),
  viewClose: $('viewClose'),
  editOverlay: $('editOverlay'),
  editForm: $('editForm'),
  editHeading: $('editHeading'),
  fTitle: $('fTitle'),
  fBody: $('fBody'),
  deleteBtn: $('deleteBtn'),
  cancelBtn: $('cancelBtn'),
  editClose: $('editClose'),
  toast: $('toast'),
};

let prompts = [];
let locked = true;
let openId = null;   // im Ansicht-Modal
let editId = null;   // null = neuer Prompt

/* ---------------- Storage ---------------- */

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    // Erster Besuch: ein Beispiel-Prompt als Starthilfe
    prompts = seed();
    save();
  } else {
    try {
      const parsed = JSON.parse(raw);
      prompts = Array.isArray(parsed) ? parsed : [];
    } catch {
      prompts = [];
    }
  }
  locked = localStorage.getItem(LOCK_KEY) !== 'false';
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
  } catch {
    toast('Speichern fehlgeschlagen — Speicher voll?', true);
  }
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

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/* ---------------- Rendering ---------------- */

function render() {
  const q = el.search.value.trim().toLowerCase();
  const list = q
    ? prompts.filter(p =>
        p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q))
    : prompts;

  el.grid.innerHTML = '';

  list.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = p.id;
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    card.draggable = !locked && !q;

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = p.title;

    const preview = document.createElement('div');
    preview.className = 'card-preview';
    preview.textContent = p.body.replace(/\s+/g, ' ').slice(0, 120);

    const foot = document.createElement('div');
    foot.className = 'card-foot';

    const meta = document.createElement('span');
    meta.textContent = `${p.body.length} Zeichen`;
    foot.appendChild(meta);

    const actions = document.createElement('span');
    actions.style.display = 'flex';
    actions.style.gap = '6px';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'mini';
    copyBtn.textContent = '📋';
    copyBtn.title = 'Prompt kopieren';
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyText(p.body);
    });
    actions.appendChild(copyBtn);

    if (!locked) {
      const editBtn = document.createElement('button');
      editBtn.className = 'mini';
      editBtn.textContent = '✎';
      editBtn.title = 'Bearbeiten';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEdit(p.id);
      });
      actions.appendChild(editBtn);

      const handle = document.createElement('span');
      handle.className = 'mini drag-handle';
      handle.textContent = '⠿';
      handle.title = 'Zum Sortieren ziehen';
      actions.appendChild(handle);
    }

    foot.appendChild(actions);
    card.append(title, preview, foot);

    card.addEventListener('click', () => openView(p.id));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openView(p.id); }
    });

    if (card.draggable) attachDrag(card);

    el.grid.appendChild(card);
  });

  el.empty.hidden = list.length > 0;
  if (list.length === 0 && q) {
    el.empty.querySelector('.empty-title').textContent = 'Kein Treffer';
    el.empty.querySelector('p:last-child').textContent = `Keine Prompts für „${el.search.value}".`;
  } else {
    el.empty.querySelector('.empty-title').textContent = 'Noch keine Prompts';
    el.empty.querySelector('p:last-child').textContent =
      'Klicke auf das Schloss 🔒 oben rechts, um zu entsperren, und lege deinen ersten Prompt an.';
  }

  el.count.textContent = `${prompts.length} ${prompts.length === 1 ? 'Prompt' : 'Prompts'}`;
}

/* ---------------- Sortieren per Drag & Drop ---------------- */

let dragId = null;

function attachDrag(card) {
  card.addEventListener('dragstart', (e) => {
    dragId = card.dataset.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
  });
  card.addEventListener('dragend', () => {
    dragId = null;
    card.classList.remove('dragging');
    document.querySelectorAll('.drop-target').forEach(c => c.classList.remove('drop-target'));
  });
  card.addEventListener('dragover', (e) => {
    if (!dragId || dragId === card.dataset.id) return;
    e.preventDefault();
    card.classList.add('drop-target');
  });
  card.addEventListener('dragleave', () => card.classList.remove('drop-target'));
  card.addEventListener('drop', (e) => {
    e.preventDefault();
    card.classList.remove('drop-target');
    if (!dragId || dragId === card.dataset.id) return;
    const from = prompts.findIndex(p => p.id === dragId);
    const to = prompts.findIndex(p => p.id === card.dataset.id);
    if (from < 0 || to < 0) return;
    const [moved] = prompts.splice(from, 1);
    prompts.splice(to, 0, moved);
    save();
    render();
  });
}

/* ---------------- Lock ---------------- */

function setLocked(value) {
  locked = value;
  localStorage.setItem(LOCK_KEY, String(locked));
  document.body.classList.toggle('unlocked', !locked);
  el.lockIcon.textContent = locked ? '🔒' : '🔓';
  el.lockText.textContent = locked ? 'Gesperrt' : 'Entsperrt';
  el.addBtn.hidden = locked;
  el.importBtn.hidden = locked;
  el.viewEdit.hidden = locked;
  render();
}

/* ---------------- Ansicht ---------------- */

function openView(id) {
  const p = prompts.find(x => x.id === id);
  if (!p) return;
  openId = id;
  el.viewTitle.textContent = p.title;
  el.viewBody.textContent = p.body;
  el.viewMeta.textContent =
    `${p.body.length} Zeichen · zuletzt geändert ${new Date(p.updated).toLocaleDateString('de-CH')}`;
  el.viewOverlay.hidden = false;
  el.viewCopy.focus();
}

function closeView() {
  el.viewOverlay.hidden = true;
  openId = null;
}

/* ---------------- Bearbeiten ---------------- */

function openEdit(id) {
  if (locked) return;
  editId = id ?? null;
  const p = id ? prompts.find(x => x.id === id) : null;
  el.editHeading.textContent = p ? 'Prompt bearbeiten' : 'Neuer Prompt';
  el.fTitle.value = p ? p.title : '';
  el.fBody.value = p ? p.body : '';
  el.deleteBtn.hidden = !p;
  el.editOverlay.hidden = false;
  el.fTitle.focus();
}

function closeEdit() {
  el.editOverlay.hidden = true;
  editId = null;
}

el.editForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = el.fTitle.value.trim();
  const body = el.fBody.value.trim();
  if (!title || !body) return;

  if (editId) {
    const p = prompts.find(x => x.id === editId);
    if (p) { p.title = title; p.body = body; p.updated = Date.now(); }
  } else {
    prompts.unshift({ id: uid(), title, body, created: Date.now(), updated: Date.now() });
  }
  save();
  closeEdit();
  closeView();
  render();
  toast('Gespeichert');
});

el.deleteBtn.addEventListener('click', () => {
  const p = prompts.find(x => x.id === editId);
  if (!p) return;
  if (!confirm(`„${p.title}" wirklich löschen?`)) return;
  prompts = prompts.filter(x => x.id !== editId);
  save();
  closeEdit();
  closeView();
  render();
  toast('Gelöscht');
});

/* ---------------- Kopieren ---------------- */

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Prompt kopiert ✓');
  } catch {
    // Fallback für Browser ohne Clipboard-API
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
  el.toast.style.background = isError ? 'var(--danger)' : 'var(--ok)';
  el.toast.style.color = isError ? '#fff' : '#06140d';
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, 1600);
}

/* ---------------- Export / Import ---------------- */

el.exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(prompts, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `prompts-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

el.importBtn.addEventListener('click', () => el.importFile.click());

el.importFile.addEventListener('change', async () => {
  const file = el.importFile.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw new Error('kein Array');
    const clean = data
      .filter(p => p && typeof p.title === 'string' && typeof p.body === 'string')
      .map(p => ({
        id: uid(),
        title: p.title,
        body: p.body,
        created: Number(p.created) || Date.now(),
        updated: Number(p.updated) || Date.now(),
      }));
    if (!clean.length) throw new Error('leer');
    prompts = clean.concat(prompts);
    save();
    render();
    toast(`${clean.length} Prompts importiert`);
  } catch {
    toast('Datei konnte nicht gelesen werden', true);
  }
  el.importFile.value = '';
});

/* ---------------- Events ---------------- */

el.lockBtn.addEventListener('click', () => setLocked(!locked));
el.addBtn.addEventListener('click', () => openEdit(null));
el.search.addEventListener('input', render);

el.viewCopy.addEventListener('click', () => {
  const p = prompts.find(x => x.id === openId);
  if (p) copyText(p.body);
});
el.viewEdit.addEventListener('click', () => openEdit(openId));
el.viewClose.addEventListener('click', closeView);
el.cancelBtn.addEventListener('click', closeEdit);
el.editClose.addEventListener('click', closeEdit);

el.viewOverlay.addEventListener('click', (e) => { if (e.target === el.viewOverlay) closeView(); });
el.editOverlay.addEventListener('click', (e) => { if (e.target === el.editOverlay) closeEdit(); });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!el.editOverlay.hidden) closeEdit();
    else if (!el.viewOverlay.hidden) closeView();
  }
  // Strg/Cmd + Enter im Editor speichert
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !el.editOverlay.hidden) {
    el.editForm.requestSubmit();
  }
});

/* ---------------- Start ---------------- */

load();
setLocked(locked);
