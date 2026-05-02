/**
 * api.js — Arabic Diacritics Editor
 * Phase 1: API wrappers, file tree rendering, and error handling.
 */

window.API = {
    // --- Core API Wrappers ---

    async getConfig() {
        try {
            const res = await fetch('/api/config');
            return await res.json();
        } catch (err) {
            console.error("Failed to load config:", err);
            return { keymap: {} };
        }
    },

    async openFile(filePath) {
        const res = await fetch('/api/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_path: filePath })
        });
        return await res.json();
    },

    async writeChar(payload) {
        // payload: { file_path, line_idx, word_idx, char_idx, new_cluster }
        try {
            const res = await fetch('/api/write_char', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await res.json().catch(() => ({ error: "Invalid JSON response" }));
            
            if (!res.ok || !data.ok) {
                this.showBlockingError(data.error || `HTTP ${res.status}: Write failed`);
                return false;
            }
            return true;
        } catch (err) {
            this.showBlockingError(`Network error: ${err.message}`);
            return false;
        }
    },

    async saveCursor(filePath, cursor) {
        try {
            await fetch('/api/save_cursor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_path: filePath, cursor })
            });
        } catch (err) {
            console.error("Failed to save cursor:", err);
        }
    },

    async markComplete(filePath) {
        try {
            const res = await fetch('/api/mark_complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_path: filePath })
            });
            return await res.json();
        } catch (err) {
            return { error: err.message };
        }
    },

    async resetFile(filePath) {
        try {
            const res = await fetch('/api/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_path: filePath })
            });
            return await res.json();
        } catch (err) {
            return { error: err.message };
        }
    },

    // --- UI Integration & File Tree ---

    async loadFileTree() {
        try {
            const res = await fetch('/api/files');
            const data = await res.json();
            const container = document.getElementById('file-tree');
            container.innerHTML = '';

            if (!data.files || data.files.length === 0) {
                container.innerHTML = '<div style="padding: 16px; color: #666;">No .txt or .md files found.</div>';
                return;
            }

            data.files.forEach(f => {
                const div = document.createElement('div');
                div.className = `file-entry status-${f.status}`;
                
                // Determine icon based on status (spec §11)
                let icon = '○';
                if (f.status === 'in_progress') icon = '●';
                if (f.status === 'complete') icon = '✓';

                div.innerHTML = `
                    <span class="status-icon">${icon}</span>
                    <span class="file-name" title="${f.path}">${f.path}</span>
                `;
                
                // Highlight active file if one is already open
                if (window.currentFilePath === f.path) {
                    div.classList.add('active');
                }

                div.onclick = () => this.handleFileClick(f.path, div);
                container.appendChild(div);
            });
        } catch (err) {
            console.error("Failed to load file tree:", err);
        }
    },

    async handleFileClick(filePath, element) {
        // 1. Flush cursor if switching away from an active file (spec §10)
        if (window.currentFilePath && window.currentFilePath !== filePath) {
            if (typeof window.flushCursorNow === 'function') {
                await window.flushCursorNow();
            }
        }

        // 2. Update UI active state in sidebar
        document.querySelectorAll('.file-entry').forEach(el => el.classList.remove('active'));
        if (element) element.classList.add('active');

        // 3. Fetch file data
        const res = await this.openFile(filePath);
        if (res.error) {
            alert(`Failed to open file: ${res.error}`);
            return;
        }

        // 4. Update global state
        window.currentFilePath = filePath;
        
        // 5. Enable sidebar buttons & hide empty state
        document.getElementById('btn-mark-complete').disabled = false;
        document.getElementById('btn-reset').disabled = false;
        document.getElementById('empty-state').style.display = 'none';

        // 6. Handle mtime conflict warning (spec §2.5)
        const conflictBanner = document.getElementById('conflict-banner');
        if (res.conflict_detected) {
            conflictBanner.classList.add('visible');
        } else {
            conflictBanner.classList.remove('visible');
        }

        // 7. Pass data to Phase 2 renderer (if it exists yet)
        if (typeof window.renderDocument === 'function') {
            window.renderDocument(res.lines, res.cursor);
        } else {
            // Temporary placeholder for Phase 1 testing
            console.log("[Phase 1] File opened successfully:", filePath);
            console.log("[Phase 1] Lines:", res.lines.length);
            console.log("[Phase 1] Cursor:", res.cursor);
        }
    },

    // --- Error Banner Management (Plan §Task 1.4) ---

    showBlockingError(message) {
        const banner = document.getElementById('error-banner');
        const msgEl = document.getElementById('error-banner-msg');
        msgEl.textContent = message;
        banner.classList.add('visible');
    },

    clearBlockingError() {
        const banner = document.getElementById('error-banner');
        banner.classList.remove('visible');
    }
};