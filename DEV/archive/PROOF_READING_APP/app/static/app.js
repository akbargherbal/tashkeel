/**
 * Arabic Proofreading App — Frontend
 * All state is stored in the `state` object.
 * All DOM manipulation flows through render functions.
 *
 * §9.2 Zen Focus: The document body uses a teleprompter layout.
 * Standard browser scrolling is disabled. Instead, a #zen-track div
 * is translated vertically (transform: translateY) so the active line
 * is always locked to the vertical centre of #doc-body.
 */

// ── State ─────────────────────────────────────────────────────────────────

const state = {
  folder: null,           // current project folder path
  tree: [],               // file tree from API
  fileMap: {},            // path → tree node (flattened)

  filePath: null,         // currently open file path
  fileContent: null,      // raw file text
  lines: [],              // array of arrays: lines[lineIdx] = [word, ...]
  nonEmptyLineIndices: [], // indices of lines that have words

  cursor: { line: 0, word: 0 },
  flagged: {},            // { "lineIdx": [wordIdx, ...] }
  fileStatus: "untouched",

  docHasFocus: false,
  saveTimer: null,        // debounce timer id
  saveInFlight: null,     // tracks the in-flight save promise
  pendingSave: false,
};

// ── Init ──────────────────────────────────────────────────────────────────

window.addEventListener("DOMContentLoaded", async () => {
  bindDocPaneEvents();
  const cfg = await api("/api/config");
  if (cfg.last_folder) {
    await loadProject(cfg.last_folder, cfg.last_open_file || null);
  }
});

window.addEventListener("beforeunload", () => {
  if (state.filePath) saveNow();
});

// ── API Helpers ───────────────────────────────────────────────────────────

async function api(url, opts = {}) {
  try {
    const res = await fetch(url, opts);
    return await res.json();
  } catch (e) {
    console.error("API error:", url, e);
    return { error: e.message };
  }
}

async function apiPost(url, body) {
  return api(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Folder / Project ──────────────────────────────────────────────────────

function openFolderPanel() {
  const panel = document.getElementById("folder-panel");
  const input = document.getElementById("folder-input");
  panel.classList.add("open");
  input.value = state.folder || "";
  input.focus();
  document.getElementById("folder-error").style.display = "none";

  // allow Enter key in folder input
  input.onkeydown = (e) => { if (e.key === "Enter") loadFolder(); };
}

function closeFolderPanel() {
  document.getElementById("folder-panel").classList.remove("open");
}

async function browseFolder() {
  const btn = document.getElementById("browse-btn");
  btn.disabled = true;
  btn.textContent = "Opening…";
  const res = await api("/api/browse");
  btn.disabled = false;
  btn.textContent = "Browse…";
  if (res.cancelled || res.error) return;
  document.getElementById("folder-input").value = res.path;
  document.getElementById("folder-error").style.display = "none";
}

async function loadFolder() {
  const input = document.getElementById("folder-input");
  const errEl = document.getElementById("folder-error");
  const folder = input.value.trim();
  if (!folder) return;

  errEl.style.display = "none";

  const data = await api(`/api/project?folder=${encodeURIComponent(folder)}`);
  if (data.error) {
    errEl.textContent = data.error;
    errEl.style.display = "block";
    return;
  }

  closeFolderPanel();
  await saveCurrentFile(); // save before switching
  await loadProject(folder, null);
  await apiPost("/api/config", { last_folder: folder });
}

async function loadProject(folder, autoOpenFile) {
  const data = await api(`/api/project?folder=${encodeURIComponent(folder)}`);
  if (data.error) {
    showError(data.error);
    return;
  }

  state.folder = folder;
  state.tree = data.tree;
  state.fileMap = {};
  flattenTree(state.tree, state.fileMap);

  document.getElementById("toolbar-path").textContent = folder;
  renderSidebar();

  if (data.tree.length === 0) {
    setDocEmpty("No .txt or .md files found in this folder.");
    return;
  }

  if (autoOpenFile && state.fileMap[autoOpenFile]) {
    await openFile(autoOpenFile);
  }
}

function flattenTree(nodes, map) {
  for (const node of nodes) {
    if (node.type === "file") {
      map[node.path] = node;
    } else if (node.children) {
      flattenTree(node.children, map);
    }
  }
}

// ── Sidebar ───────────────────────────────────────────────────────────────

function renderSidebar() {
  const tree = document.getElementById("sidebar-tree");
  if (!state.tree || state.tree.length === 0) {
    tree.innerHTML = '<div style="padding:12px 10px; color:#64748b; font-size:13px;">No .txt or .md files found in this folder.</div>';
    return;
  }
  tree.innerHTML = "";
  renderTreeNodes(state.tree, tree, 0);
}

function renderTreeNodes(nodes, container, depth) {
  for (const node of nodes) {
    if (node.type === "folder") {
      const folderEl = document.createElement("div");
      folderEl.className = "tree-folder";
      folderEl.style.paddingLeft = `${10 + depth * 14}px`;
      folderEl.textContent = `📁 ${node.name}`;
      container.appendChild(folderEl);
      if (node.children) renderTreeNodes(node.children, container, depth + 1);
    } else {
      const fileEl = document.createElement("div");
      fileEl.className = "tree-file";
      fileEl.style.paddingLeft = `${24 + depth * 14}px`;
      if (node.path === state.filePath) fileEl.classList.add("active");
      fileEl.dataset.path = node.path;

      const icon = document.createElement("span");
      icon.className = `status-icon status-${node.status}`;
      icon.textContent = statusIcon(node.status);

      const name = document.createElement("span");
      name.textContent = node.name;
      name.style.overflow = "hidden";
      name.style.textOverflow = "ellipsis";

      fileEl.appendChild(icon);
      fileEl.appendChild(name);
      fileEl.onclick = () => onFileClick(node.path);
      container.appendChild(fileEl);
    }
  }
}

function statusIcon(status) {
  if (status === "complete") return "✓";
  if (status === "in_progress") return "●";
  return "○";
}

function updateSidebarFileStatus(path, status) {
  if (state.fileMap[path]) state.fileMap[path].status = status;
  // Update DOM icon
  const el = document.querySelector(`.tree-file[data-path="${CSS.escape(path)}"]`);
  if (el) {
    const icon = el.querySelector(".status-icon");
    if (icon) {
      icon.className = `status-icon status-${status}`;
      icon.textContent = statusIcon(status);
    }
  }
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

// ── File open ─────────────────────────────────────────────────────────────

async function onFileClick(path) {
  if (path === state.filePath) return;
  await saveCurrentFile();
  await openFile(path);
}

async function openFile(path) {
  // mark active in sidebar
  document.querySelectorAll(".tree-file").forEach(el => {
    el.classList.toggle("active", el.dataset.path === path);
  });

  const fileData = await api(`/api/file?path=${encodeURIComponent(path)}`);
  if (fileData.error) {
    setDocEmpty(`Error reading file: ${fileData.error}`);
    state.filePath = path;
    document.getElementById("doc-title").textContent = path.split(/[/\\]/).pop();
    return;
  }

  const progressData = await api(`/api/progress?path=${encodeURIComponent(path)}`);

  state.filePath = path;
  state.fileContent = fileData.content;
  state.lines = tokenize(fileData.content);
  state.nonEmptyLineIndices = state.lines
    .map((w, i) => (w.length > 0 ? i : -1))
    .filter(i => i >= 0);

  // Restore or init cursor
  if (progressData.cursor) {
    let li = progressData.cursor.line_index || 0;
    let wi = progressData.cursor.word_index || 0;
    // Clamp
    li = Math.min(li, state.lines.length - 1);
    if (state.lines[li]) wi = Math.min(wi, Math.max(0, state.lines[li].length - 1));
    state.cursor = { line: li, word: wi };
  } else {
    // Place at first non-empty line
    state.cursor = { line: state.nonEmptyLineIndices[0] ?? 0, word: 0 };
  }

  state.flagged = progressData.flagged ? deepCloneFlagged(progressData.flagged) : {};
  state.fileStatus = progressData.status || "untouched";

  await apiPost("/api/config", { last_open_file: path });
  document.getElementById("reset-btn").disabled = false;

  renderDoc();
}

function deepCloneFlagged(f) {
  const out = {};
  for (const k of Object.keys(f)) {
    out[k] = [...f[k]];
  }
  return out;
}

// ── Tokenize ──────────────────────────────────────────────────────────────

function tokenize(text) {
  return text.split("\n").map(line => line.split(/\s+/).filter(w => w.length > 0));
}

// ── Render document (Zen Focus) ────────────────────────────────────────────

function renderDoc() {
  const body = document.getElementById("doc-body");
  const empty = document.getElementById("doc-empty");
  const title = document.getElementById("doc-title");
  const completeBanner = document.getElementById("complete-banner");
  const markBtn = document.getElementById("mark-complete-btn");

  title.textContent = state.filePath ? state.filePath.split(/[/\\]/).pop() : "No document open";
  empty.style.display = "none";

  if (!state.filePath) {
    empty.style.display = "flex";
    empty.textContent = "Open a project folder and select a file.";
    body.innerHTML = "";
    return;
  }

  if (state.nonEmptyLineIndices.length === 0) {
    empty.style.display = "flex";
    empty.textContent = "This file is empty.";
    body.innerHTML = "";
    return;
  }

  const isComplete = state.fileStatus === "complete";
  completeBanner.style.display = isComplete ? "flex" : "none";
  markBtn.style.display = isComplete ? "none" : "inline-block";

  // ── Build zen-track ──────────────────────────────────────────
  body.innerHTML = "";
  const track = document.createElement("div");
  track.id = "zen-track";
  // Disable transition for initial render; JS will re-enable after first paint.
  track.style.transition = "none";
  body.appendChild(track);

  state.lines.forEach((words, lineIdx) => {
    const lineEl = document.createElement("div");
    lineEl.className = "line-block";
    lineEl.dataset.lineIdx = lineIdx;

    if (words.length === 0) {
      lineEl.classList.add("empty-line");
      track.appendChild(lineEl);
      return;
    }

    const flaggedOnLine = state.flagged[String(lineIdx)] || [];
    words.forEach((word, wordIdx) => {
      if (wordIdx > 0) {
        lineEl.appendChild(document.createTextNode(" "));
      }
      const span = document.createElement("span");
      span.className = "word-span";
      span.textContent = word;
      span.dataset.lineIdx = lineIdx;
      span.dataset.wordIdx = wordIdx;

      const isCursor = (lineIdx === state.cursor.line && wordIdx === state.cursor.word);
      const isFlagged = flaggedOnLine.includes(wordIdx);
      if (isCursor) span.classList.add("cursor");
      if (isFlagged) span.classList.add("flagged");

      lineEl.appendChild(span);
    });
    track.appendChild(lineEl);
  });

  updateZenClasses();
  updateStatusBar();

  // Wait for layout to settle, then snap to position without animation.
  requestAnimationFrame(() => {
    updateZenTranslation(false);
    document.getElementById("doc-pane").focus();
  });
}

function updateStatusBar() {
  const posEl = document.getElementById("status-pos");
  const flagEl = document.getElementById("status-flagged");

  if (!state.filePath || state.nonEmptyLineIndices.length === 0) {
    posEl.textContent = "—";
    flagEl.textContent = "—";
    return;
  }

  const lineNum = state.cursor.line + 1;
  const wordNum = state.cursor.word + 1;
  const wordsOnLine = state.lines[state.cursor.line]?.length || 0;

  const totalFlagged = Object.values(state.flagged).reduce((s, arr) => s + arr.length, 0);

  posEl.textContent = `Line ${lineNum} / ${state.lines.length}   Word ${wordNum} / ${wordsOnLine}`;
  flagEl.textContent = `Flagged: ${totalFlagged}`;
}

function setDocEmpty(msg) {
  const empty = document.getElementById("doc-empty");
  const body = document.getElementById("doc-body");
  body.innerHTML = "";
  empty.style.display = "flex";
  empty.textContent = msg;
  document.getElementById("doc-title").textContent = state.filePath?.split(/[/\\]/).pop() || "—";
  document.getElementById("mark-complete-btn").style.display = "none";
  document.getElementById("complete-banner").style.display = "none";
}

// ── Zen Focus helpers ──────────────────────────────────────────────────────

function getAdjacentNonEmptyLines(lineIdx) {
  const neli = state.nonEmptyLineIndices;
  const pos = neli.indexOf(lineIdx);
  const prev = pos > 0 ? neli[pos - 1] : null;
  const next = pos < neli.length - 1 ? neli[pos + 1] : null;
  return { prev, next };
}

function updateZenClasses() {
  const { prev, next } = getAdjacentNonEmptyLines(state.cursor.line);
  document.querySelectorAll(".line-block:not(.empty-line)").forEach(el => {
    const li = parseInt(el.dataset.lineIdx, 10);
    el.classList.remove("zen-active", "zen-context", "zen-far");
    if (li === state.cursor.line) {
      el.classList.add("zen-active");
    } else if (li === prev || li === next) {
      el.classList.add("zen-context");
    } else {
      el.classList.add("zen-far");
    }
  });
}

function updateZenTranslation(animate) {
  const body = document.getElementById("doc-body");
  const track = document.getElementById("zen-track");
  if (!track || !body) return;

  const activeEl = track.querySelector(`.line-block[data-line-idx="${state.cursor.line}"]`);
  if (!activeEl) return;

  const bodyHeight = body.clientHeight;
  const lineTop = activeEl.offsetTop;
  const lineHeight = activeEl.offsetHeight;

  const translateY = Math.round((bodyHeight / 2) - lineTop - (lineHeight / 2));

  if (animate) {
    track.style.transition = "transform 200ms cubic-bezier(0.4, 0, 0.2, 1)";
    track.style.transform = `translateY(${translateY}px)`;
  } else {
    track.style.transition = "none";
    track.style.transform = `translateY(${translateY}px)`;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (track) {
          track.style.transition = "transform 200ms cubic-bezier(0.4, 0, 0.2, 1)";
        }
      });
    });
  }
}

// ── Keyboard navigation ────────────────────────────────────────────────────

function bindDocPaneEvents() {
  const pane = document.getElementById("doc-pane");
  pane.addEventListener("focus", () => { state.docHasFocus = true; });
  pane.addEventListener("blur", () => { state.docHasFocus = false; });
  window.addEventListener("keydown", onKeyDown);
}

function onKeyDown(e) {
  if (!state.docHasFocus) return;
  if (!state.filePath || state.nonEmptyLineIndices.length === 0) return;
  if (state.fileStatus === "complete") return; // read-only

  // Don't capture if focus is in an input
  if (document.activeElement && document.activeElement.tagName === "INPUT") return;

  const key = e.key;
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(key)) return;

  e.preventDefault(); // §9.2: disable browser scroll

  if (key === "ArrowLeft") moveNext();
  else if (key === "ArrowRight") movePrev();
  else if (key === "ArrowDown") moveDown();
  else if (key === "ArrowUp") moveUp();
  else if (key === " ") toggleFlag();
}

function nonEmptyLinesAbove(lineIdx) {
  return state.nonEmptyLineIndices.filter(i => i < lineIdx);
}

function nonEmptyLinesBelow(lineIdx) {
  return state.nonEmptyLineIndices.filter(i => i > lineIdx);
}

function moveNext() {
  const { line, word } = state.cursor;
  const words = state.lines[line] || [];
  if (word < words.length - 1) {
    moveCursorTo(line, word + 1);
  } else {
    const below = nonEmptyLinesBelow(line);
    if (below.length > 0) {
      moveCursorTo(below[0], 0);
    }
  }
}

function movePrev() {
  const { line, word } = state.cursor;
  if (word > 0) {
    moveCursorTo(line, word - 1);
  } else {
    const above = nonEmptyLinesAbove(line);
    if (above.length > 0) {
      const prevLine = above[above.length - 1];
      const lastWord = (state.lines[prevLine] || []).length - 1;
      moveCursorTo(prevLine, Math.max(0, lastWord));
    }
  }
}

function moveDown() {
  const below = nonEmptyLinesBelow(state.cursor.line);
  if (below.length === 0) return;
  const nextLine = below[0];
  const clamped = Math.min(state.cursor.word, (state.lines[nextLine] || []).length - 1);
  moveCursorTo(nextLine, Math.max(0, clamped));
}

function moveUp() {
  const above = nonEmptyLinesAbove(state.cursor.line);
  if (above.length === 0) return;
  const prevLine = above[above.length - 1];
  const clamped = Math.min(state.cursor.word, (state.lines[prevLine] || []).length - 1);
  moveCursorTo(prevLine, Math.max(0, clamped));
}

function moveCursorTo(line, word) {
  const oldEl = document.querySelector(".word-span.cursor");
  if (oldEl) oldEl.classList.remove("cursor");

  state.cursor = { line, word };

  const newEl = document.querySelector(`.word-span[data-line-idx="${line}"][data-word-idx="${word}"]`);
  if (newEl) newEl.classList.add("cursor");

  updateZenClasses();
  updateZenTranslation(true);
  updateStatusBar();
  debounceSave();
}

// ── Flagging ───────────────────────────────────────────────────────────────

function toggleFlag() {
  if (state.fileStatus === "complete") return;
  const { line, word } = state.cursor;
  const key = String(line);

  if (!state.flagged[key]) state.flagged[key] = [];
  const arr = state.flagged[key];
  const idx = arr.indexOf(word);
  if (idx === -1) {
    arr.push(word);
  } else {
    arr.splice(idx, 1);
    if (arr.length === 0) delete state.flagged[key];
  }

  // Update span class
  const span = document.querySelector(`.word-span[data-line-idx="${line}"][data-word-idx="${word}"]`);
  if (span) span.classList.toggle("flagged", idx === -1);

  updateStatusBar();
  saveNow(); // immediate save on flag toggle
}

// ── Save ───────────────────────────────────────────────────────────────────

function buildSidecar() {
  return {
    source_path: state.filePath,
    status: state.fileStatus,
    cursor: { line_index: state.cursor.line, word_index: state.cursor.word },
    flagged: state.flagged,
  };
}

async function saveNow() {
  if (!state.filePath) return;
  clearTimeout(state.saveTimer);

  state.saveInFlight = (async () => {
    const data = buildSidecar();
    const res = await apiPost("/api/progress", data);
    state.saveInFlight = null;
    if (res.error) {
      setSaveStatus("⚠ Auto-save failed");
    } else {
      setSaveStatus("");
      // transition to in_progress on first save, regardless of flags
      if (state.fileStatus === "untouched") {
        state.fileStatus = "in_progress";
        updateSidebarFileStatus(state.filePath, "in_progress");
      }
    }
  })();

  await state.saveInFlight;
}

function debounceSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => saveNow(), 500);
}

async function saveCurrentFile() {
  if (state.filePath) await saveNow();
}

function setSaveStatus(msg) {
  document.getElementById("save-status").textContent = msg;
}

// ── Mark complete ──────────────────────────────────────────────────────────

function confirmMarkComplete() {
  const name = state.filePath?.split(/[/\\]/).pop() || "";
  showConfirm(
    "Mark as Complete",
    `Mark <strong>${escHtml(name)}</strong> as fully reviewed and complete? This cannot be undone without resetting the document.`,
    "Confirm",
    "btn-success",
    async () => {
      // 1. Cancel pending debounce
      clearTimeout(state.saveTimer);

      // 2. Await any in-flight save
      if (state.saveInFlight) await state.saveInFlight;

      // 3. Atomic call to /api/complete
      const prevStatus = state.fileStatus;
      state.fileStatus = "complete";

      const res = await apiPost("/api/complete", {
        source_path: state.filePath,
        cursor: { line_index: state.cursor.line, word_index: state.cursor.word },
        flagged: state.flagged,
      });

      // 4. On failure: revert and show blocking modal
      if (res.error) {
        state.fileStatus = prevStatus;
        showBlockingError("Could not mark complete — please try again.\n\n" + res.error);
        return;
      }

      // 5. On success
      updateSidebarFileStatus(state.filePath, "complete");
      showToast("Document marked complete. Annotated copy saved.");
      renderDoc();
    }
  );
}

// ── Reset document ─────────────────────────────────────────────────────────

function confirmReset() {
  if (!state.filePath) return;
  const name = state.filePath.split(/[/\\]/).pop();
  showConfirm(
    "Reset Document",
    `Reset all highlights and progress for <strong>${escHtml(name)}</strong>? All flagged words will be cleared and status reset to untouched.`,
    "Reset",
    "btn-danger",
    async () => {
      clearTimeout(state.saveTimer);
      const blank = {
        source_path: state.filePath,
        status: "untouched",
        cursor: { line_index: 0, word_index: 0 },
        flagged: {},
      };
      await apiPost("/api/progress", blank);
      state.fileStatus = "untouched";
      state.flagged = {};
      state.cursor = { line: state.nonEmptyLineIndices[0] ?? 0, word: 0 };
      updateSidebarFileStatus(state.filePath, "untouched");
      renderDoc();
    }
  );
}

// ── Download annotated copy ────────────────────────────────────────────────

async function downloadAnnotatedCopy() {
  if (!state.filePath) return;
  const res = await api(`/api/export?path=${encodeURIComponent(state.filePath)}`);
  if (res.error) {
    showToast(`⚠ ${res.error}`);
  } else {
    showToast(`Annotated copy saved: ${res.annotated_copy_path}`);
  }
}

// ── Confirm modal ─────────────────────────────────────────────────────────

let _confirmCallback = null;

function showConfirm(title, bodyHtml, actionLabel, actionClass, callback) {
  document.getElementById("confirm-title").textContent = title;
  document.getElementById("confirm-body").innerHTML = bodyHtml;
  const btn = document.getElementById("confirm-action-btn");
  btn.textContent = actionLabel;
  btn.className = `btn ${actionClass}`;
  _confirmCallback = callback;
  document.getElementById("confirm-modal").classList.add("open");
}

function closeConfirm() {
  document.getElementById("confirm-modal").classList.remove("open");
  _confirmCallback = null;
}

document.getElementById("confirm-action-btn").onclick = async () => {
  // Save the callback before closeConfirm() erases it
  const cb = _confirmCallback;
  closeConfirm();
  if (cb) await cb();
};

// ── Blocking error modal ───────────────────────────────────────────────────

function showBlockingError(message) {
  document.getElementById("blocking-error-body").textContent = message;
  document.getElementById("blocking-error-modal").classList.add("open");
}

function closeBlockingError() {
  document.getElementById("blocking-error-modal").classList.remove("open");
}

// ── Help modal ─────────────────────────────────────────────────────────────

function openHelp() {
  document.getElementById("help-modal").classList.add("open");
}

function closeHelp() {
  document.getElementById("help-modal").classList.remove("open");
  document.getElementById("doc-pane").focus();
}

// Dismiss modals on overlay click
document.getElementById("help-modal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeHelp();
});
document.getElementById("confirm-modal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeConfirm();
});
document.getElementById("folder-panel").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeFolderPanel();
});

// ── Toast ─────────────────────────────────────────────────────────────────

let _toastTimer = null;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

// ── Utils ─────────────────────────────────────────────────────────────────

function escHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function showError(msg) {
  setDocEmpty(`⚠ ${msg}`);
}
