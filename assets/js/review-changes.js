(async function () {
    const list = document.getElementById('changes-list');
    const statusCard = document.getElementById('diff-status-card');
    const countText = document.getElementById('diff-count-text');
    const lastText = document.getElementById('last-backup-text');

    if (!list || !statusCard) return; // Not on the right page

    try {
        const resp = await fetch('api/backup/diff.php');
        const data = await resp.json();

        lastText.innerText = data.last_backup ? `Last synced: ${new Date(data.last_backup).toLocaleString()}` : 'Never backed up';

        if (!data.changes || data.changes.length === 0) {
            statusCard.classList.replace('bg-white', 'bg-emerald-50');
            statusCard.querySelector('div').classList.replace('bg-amber-50', 'bg-emerald-100');
            statusCard.querySelector('span').innerText = 'check_circle';
            statusCard.querySelector('span').classList.replace('text-amber-500', 'text-emerald-600');
            countText.innerText = "Everything is backed up!";
            countText.classList.replace('text-slate-800', 'text-emerald-700');

            list.innerHTML = `
                <div class="text-center py-20 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                    <span class="material-symbols-outlined text-6xl text-slate-300 mb-4">cloud_done</span>
                    <p class="text-slate-500 font-bold">No new changes detected since your last backup.</p>
                </div>
            `;
            const timelineLine = document.getElementById('timeline-line');
            if (timelineLine) timelineLine.style.display = 'none';
            return;
        }

        countText.innerText = `${data.count} unsaved updates`;
        list.innerHTML = '';

        data.changes.forEach((item, idx) => {
            const date = new Date(item.timestamp);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dayStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

            const card = document.createElement('div');
            card.className = "flex gap-6 group animate-in slide-in-from-bottom-2 duration-300 ease-out";
            card.style.animationDelay = `${idx * 50}ms`;

            // Color based on activity type
            let colorClass = "bg-slate-500";
            const type = item.activity_type.toLowerCase();
            if (type.includes('create')) colorClass = "bg-emerald-500";
            else if (type.includes('update')) colorClass = "bg-blue-500";
            else if (type.includes('delete')) colorClass = "bg-rose-500";
            else if (type.includes('import')) colorClass = "bg-violet-500";

            // Clean up JSON strings if they appear in the message (for readability)
            let displayMsg = item.activity_message;
            if (displayMsg.includes('{') && displayMsg.includes('}')) {
                // Remove everything from the first { to the last }
                displayMsg = displayMsg.replace(/\{.*\}/g, '').trim();
            }
            if (!displayMsg) displayMsg = item.activity_type.replace('_', ' ');

            card.innerHTML = `
                <div class="flex-shrink-0 w-12 h-12 rounded-2xl ${colorClass} text-white flex flex-col items-center justify-center shadow-lg shadow-opacity-20 translate-y-1">
                    <span class="text-[10px] uppercase font-black opacity-80">${dayStr.split(' ')[0]}</span>
                    <span class="text-sm font-bold leading-none">${dayStr.split(' ')[1]}</span>
                </div>
                <div class="flex-grow bg-white p-5 rounded-2xl border border-slate-100 shadow-sm group-hover:shadow-md transition-all group-hover:border-slate-200">
                    <div class="flex justify-between items-start mb-1">
                        <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">${item.activity_type.replace('_', ' ')}</span>
                        <span class="text-[10px] font-bold text-slate-400">${timeStr}</span>
                    </div>
                    <p class="text-slate-700 font-semibold leading-snug">${displayMsg}</p>
                </div>
            `;
            list.appendChild(card);
        });

    } catch (err) {
        console.error('Diff error:', err);
        list.innerHTML = '<p class="text-rose-500 text-center font-bold">Failed to load changes.</p>';
    }
})();

window.triggerQuickBackup = async function () {
    if (!window.autoBackupManager) {
        if (typeof window.showToast === 'function') {
            window.showToast('Auto-backup not configured. Go to Backup & Restore to set up.', 'warning');
        }
        return;
    }
    if (typeof window.showToast === 'function') {
        window.showToast('Starting backup...', 'info');
    }
    const res = await window.autoBackupManager.runBackupNow();
    if (res.success) {
        // Ensure server-side timestamp is updated before refreshing the diff list
        try { await fetch('api/backup/last-change.php', { method: 'POST' }); } catch (_) {}
        if (typeof window.showToast === 'function') {
            window.showToast('Backup complete! All changes synced.', 'success');
        }
        // Small delay to let server persist timestamp before diff.php re-queries
        await new Promise(r => setTimeout(r, 300));
        window.loadPage('review-changes'); // Refresh list
    } else {
        if (typeof window.showToast === 'function') {
            window.showToast('Backup failed: ' + (res.message || 'Unknown error'), 'error');
        }
    }
};
