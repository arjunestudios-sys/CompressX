/**
 * Docholder History & Recent Activity Client Logic
 */

let historyRecords = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadHistory();

    const searchInput = document.getElementById('history-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderHistory(e.target.value);
        });
    }

    const btnRefresh = document.getElementById('btn-refresh-history');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', async () => {
            await loadHistory();
            showToast('History refreshed', 'info', 1500);
        });
    }
});

async function loadHistory() {
    try {
        const data = await apiFetch('/api/convert/history');
        historyRecords = data.history || [];
        renderHistory();
    } catch(err) {
        const list = document.getElementById('history-items-list');
        if (list) list.innerHTML = `<div style="text-align: center; color: var(--danger); padding: 20px;">Failed to load history: ${err.message}</div>`;
    }
}

function renderHistory(searchQuery = '') {
    const container = document.getElementById('history-items-list');
    if (!container) return;

    const q = (searchQuery || '').toLowerCase().trim();
    let filtered = historyRecords;
    if (q) {
        filtered = filtered.filter(item => 
            (item.original_name && item.original_name.toLowerCase().includes(q)) ||
            (item.result_name && item.result_name.toLowerCase().includes(q)) ||
            (item.action_type && item.action_type.toLowerCase().includes(q))
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                <i class="fa-solid fa-clock-rotate-left" style="font-size: 2rem; margin-bottom: 8px; opacity: 0.5;"></i>
                <p>No activity records found.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(item => {
        const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        const savedBadge = item.percentage_saved > 0 ? `<span class="savings-badge" style="font-size: 0.7rem; padding: 2px 6px;">${item.percentage_saved}% Saved</span>` : '';

        return `
            <div class="glass-card" style="padding: 12px; display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <span class="badge" style="background: var(--primary-light); color: var(--primary); font-size: 0.72rem; margin-bottom: 4px; display: inline-block;">${item.action_type || 'Processed'}</span>
                        <div style="font-weight: 700; font-size: 0.85rem; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.result_name || item.original_name}</div>
                        <div style="font-size: 0.72rem; color: var(--text-secondary);">From: ${item.original_name}</div>
                    </div>
                    ${savedBadge}
                </div>

                <div class="before-after-row" style="background: var(--surface-hover); padding: 6px 10px; border-radius: var(--radius-xs); font-size: 0.75rem;">
                    <span><strong>Before:</strong> ${formatBytes(item.original_size)}</span>
                    <i class="fa-solid fa-arrow-right" style="color: var(--text-muted); font-size: 0.7rem;"></i>
                    <span><strong>After:</strong> ${formatBytes(item.result_size)}</span>
                    <span style="color: var(--text-muted); font-size: 0.7rem;">${dateStr}</span>
                </div>

                <div style="display: flex; gap: 6px; justify-content: flex-end; margin-top: 2px;">
                    ${item.download_url ? `
                        <a href="${item.download_url}" class="btn btn-primary btn-sm" style="padding: 4px 10px; font-size: 0.75rem;">
                            <i class="fa-solid fa-download"></i> Download
                        </a>
                    ` : ''}
                    <button class="btn btn-secondary btn-sm" onclick="repeatTransformation('${item.action_type}', '${item.original_name}')" style="padding: 4px 8px; font-size: 0.75rem;" title="Repeat in Studio">
                        <i class="fa-solid fa-rotate-right"></i> Repeat
                    </button>
                    <button class="icon-btn" onclick="deleteHistoryItem(${item.id})" style="width: 28px; height: 28px; font-size: 0.75rem; color: var(--danger);" title="Delete Record">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function deleteHistoryItem(id) {
    try {
        await apiFetch(`/api/convert/history/${id}`, { method: 'DELETE' });
        historyRecords = historyRecords.filter(r => r.id !== id);
        renderHistory();
        showToast('Record deleted from history.', 'info', 2000);
    } catch(err) {
        showToast(err.message || 'Failed to delete record.', 'error');
    }
}

function repeatTransformation(actionType, origName) {
    if ((actionType || '').toLowerCase().includes('video')) {
        window.location.href = 'video-tools.html';
    } else if ((actionType || '').toLowerCase().includes('audio') || (actionType || '').toLowerCase().includes('mp3')) {
        window.location.href = 'audio-tools.html';
    } else if ((actionType || '').toLowerCase().includes('pdf') || (actionType || '').toLowerCase().includes('merge') || (actionType || '').toLowerCase().includes('split')) {
        window.location.href = 'document-tools.html';
    } else if ((actionType || '').toLowerCase().includes('image') || (actionType || '').toLowerCase().includes('webp') || (actionType || '').toLowerCase().includes('jpg')) {
        window.location.href = 'image-tools.html';
    } else {
        window.location.href = 'convert.html';
    }
}
