/**
 * renderer.js
 * Document rendering, tokenization, and Zen Focus teleprompter.
 */

const segmenter = new Intl.Segmenter('ar', { granularity: 'grapheme' });
// Matches purely punctuation/symbol tokens
const PUNCT_REGEX = /^[\p{P}\p{S}]+$/u; 

// Gap 1 Fix: Standalone segmentWord function
window.segmentWord = function(word) {
    return Array.from(segmenter.segment(word)).map(s => s.segment);
};

window.renderDocument = function(rawLines, cursor) {
    const scrollPane = document.getElementById('doc-pane-scroll');
    scrollPane.innerHTML = '';
    
    window.editorState.lines = [];
    window.editorState.filePath = window.currentFilePath;
    window.editorState.status = cursor.status || 'in_progress';
    
    // Restore cursor or default to 0,0
    window.editorState.lineIdx = cursor.line || 0;
    window.editorState.wordIdx = cursor.word || 0;
    window.editorState.mode = 'word';

    rawLines.forEach((lineText, lIdx) => {
        const lineData = { words: [] };
        const lineDiv = document.createElement('div');
        lineDiv.className = 'line zen-far';
        lineDiv.id = `line-${lIdx}`;

        // Split by whitespace, keeping the whitespace tokens for rendering
        const tokens = lineText.split(/(\s+)/);
        let wordIdxCounter = 0;

        tokens.forEach(token => {
            if (!token) return;

            if (/^\s+$/.test(token)) {
                // Render whitespace exactly as it is
                lineDiv.appendChild(document.createTextNode(token));
            } else {
                // This is a word token (matches backend word_idx)
                const clusters = window.segmentWord(token);
                const isPurePunct = clusters.every(c => PUNCT_REGEX.test(c));

                const wordObj = {
                    index: wordIdxCounter,
                    clusters: clusters,
                    isNavigable: !isPurePunct,
                    undiacCount: 0,
                    hasSoftWarning: false
                };
                
                lineData.words.push(wordObj);

                const wordSpan = document.createElement('span');
                wordSpan.id = `word-${lIdx}-${wordIdxCounter}`;
                
                if (isPurePunct) {
                    wordSpan.className = 'punct';
                    wordSpan.textContent = token;
                } else {
                    wordSpan.className = 'word';
                    // Render clusters. If a cluster is punctuation attached to a word, 
                    // wrap it in a punct span for styling, but keep it in the word span.
                    clusters.forEach(cluster => {
                        if (PUNCT_REGEX.test(cluster)) {
                            const pSpan = document.createElement('span');
                            pSpan.className = 'punct';
                            pSpan.textContent = cluster;
                            wordSpan.appendChild(pSpan);
                        } else {
                            wordSpan.appendChild(document.createTextNode(cluster));
                        }
                    });
                }

                lineDiv.appendChild(wordSpan);
                wordIdxCounter++;
            }
        });

        window.editorState.lines.push(lineData);
        scrollPane.appendChild(lineDiv);
    });

    // Ensure cursor is on a valid navigable word
    window.clampCursorToNavigable();
    
    updateZenFocus();
    updateStatusBar();
};

window.updateZenFocus = function() {
    const state = window.editorState;
    const lines = document.querySelectorAll('.line');
    
    lines.forEach((line, idx) => {
        line.classList.remove('zen-active', 'zen-context', 'zen-far');
        if (idx === state.lineIdx) {
            line.classList.add('zen-active');
        } else if (Math.abs(idx - state.lineIdx) <= 2) {
            line.classList.add('zen-context');
        } else {
            line.classList.add('zen-far');
        }
    });

    // Remove active highlight from all words
    document.querySelectorAll('.word').forEach(w => w.classList.remove('word-active'));
    
    // Add highlight to current word
    const activeWordEl = document.getElementById(`word-${state.lineIdx}-${state.wordIdx}`);
    if (activeWordEl && state.mode === 'word') {
        activeWordEl.classList.add('word-active');
    }

    // Teleprompter scroll (translateY)
    const activeLineEl = document.getElementById(`line-${state.lineIdx}`);
    if (activeLineEl) {
        const scrollPane = document.getElementById('doc-pane-scroll');
        // Calculate offset to center the line. 
        // Uses CSS var --char-panel-height which is 0 in Word Mode.
        const panelHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--char-panel-height')) || 0;
        const viewportHeight = window.innerHeight - panelHeight - 36; // 36 is status bar
        
        const lineCenter = activeLineEl.offsetTop + (activeLineEl.offsetHeight / 2);
        const translateY = -(lineCenter - (viewportHeight / 2));
        
        scrollPane.style.transform = `translateY(${translateY}px)`;
    }
};

window.updateStatusBar = function() {
    const state = window.editorState;
    document.getElementById('status-mode').textContent = state.mode === 'word' ? 'WORD MODE' : 'CHARACTER MODE';
    
    const lineTotal = state.lines.length;
    const wordTotal = state.lines[state.lineIdx]?.words.length || 0;
    
    document.getElementById('status-position').textContent = 
        `Line ${state.lineIdx + 1} / ${lineTotal}  |  Word ${state.wordIdx + 1} / ${wordTotal}`;

    // Gap 3 Fix: Wire the undiacritized count
    const undiacSpan = document.getElementById('status-undiac');
    if (state.totalUndiacCount > 0) {
        undiacSpan.textContent = `Undiacritized: ${state.totalUndiacCount}`;
    } else {
        undiacSpan.textContent = `Undiacritized: –`;
    }
};

// Gap 4 Fix: Single authoritative definition of clampCursorToNavigable
window.clampCursorToNavigable = function() {
    const state = window.editorState;
    const line = state.lines[state.lineIdx];
    if (!line || line.words.length === 0) return;

    // If current word is out of bounds or not navigable, find the nearest navigable one
    if (state.wordIdx >= line.words.length) {
        state.wordIdx = line.words.length - 1;
    }
    
    while (state.wordIdx >= 0 && !line.words[state.wordIdx].isNavigable) {
        state.wordIdx--;
    }
    
    if (state.wordIdx < 0) {
        // Scan forward if no navigable word found looking backward
        state.wordIdx = 0;
        while (state.wordIdx < line.words.length && !line.words[state.wordIdx].isNavigable) {
            state.wordIdx++;
        }
    }
};