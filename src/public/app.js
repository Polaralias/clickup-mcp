const API_BASE = '/api';
let currentConnectionId = null;

// Parse query parameters
const urlParams = new URLSearchParams(window.location.search);
const redirectUri = urlParams.get('redirect_uri') || urlParams.get('callback_url');
const state = urlParams.get('state');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    if (redirectUri) {
        // OAuth Mode
        showCreate();
        document.getElementById('view-dashboard').classList.add('hidden');
        document.getElementById('cancel-btn').classList.add('hidden'); // Cannot cancel in OAuth flow
        document.getElementById('save-btn').innerText = 'Authorize & Connect';
        // Auto-fill form if needed or show empty
    } else {
        // Dashboard Mode
        loadConnections();
    }
});

function showCreate() {
    document.getElementById('view-dashboard').classList.add('hidden');
    document.getElementById('view-detail').classList.add('hidden');
    document.getElementById('view-create').classList.remove('hidden');
}

function hideCreate() {
    if (redirectUri) return; // Cannot cancel in OAuth mode
    document.getElementById('view-create').classList.add('hidden');
    document.getElementById('view-dashboard').classList.remove('hidden');
    document.getElementById('config-form').reset();
}

function hideDetail() {
    document.getElementById('view-detail').classList.add('hidden');
    document.getElementById('view-dashboard').classList.remove('hidden');
    currentConnectionId = null;
}

async function loadConnections() {
    try {
        const res = await fetch(`${API_BASE}/connections`);
        if (res.status === 500) {
            const data = await res.json();
            document.getElementById('list-container').innerHTML = `<p class="text-red-600">Error: ${data.error}</p>`;
            return;
        }
        const data = await res.json();
        const container = document.getElementById('list-container');

        if (data.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center">No connections found.</p>';
            return;
        }

        container.innerHTML = data.map(conn => `
            <div class="bg-white border rounded p-4 flex justify-between items-center hover:bg-gray-50 transition">
                <div>
                    <h3 class="font-medium text-gray-800">${conn.name}</h3>
                    <p class="text-xs text-gray-500">ID: ${conn.id}</p>
                </div>
                <div class="space-x-2">
                    <button onclick="viewConnection('${conn.id}')" class="text-blue-600 hover:text-blue-800 text-sm font-medium">Manage</button>
                    <button onclick="deleteConnection('${conn.id}')" class="text-red-500 hover:text-red-700 text-sm">Delete</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error(e);
        document.getElementById('list-container').innerHTML = '<p class="text-red-600">Failed to load connections.</p>';
    }
}

async function handleSave(event) {
    event.preventDefault();
    const btn = document.getElementById('save-btn');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Saving...';

    const name = document.getElementById('conn-name').value || 'ClickUp Connection';
    const teamId = document.getElementById('conn-teamId').value;
    const apiKey = document.getElementById('conn-apiKey').value;
    const readOnly = document.getElementById('conn-readOnly').checked;
    const selectiveWrite = document.getElementById('conn-selectiveWrite').checked;
    const writeSpaces = document.getElementById('conn-writeSpaces').value;
    const writeLists = document.getElementById('conn-writeLists').value;

    const config = {
        teamId,
        apiKey,
        readOnly,
        selectiveWrite,
        writeSpaces: writeSpaces ? writeSpaces.split(',').map(s => s.trim()) : [],
        writeLists: writeLists ? writeLists.split(',').map(s => s.trim()) : []
    };

    try {
        // 1. Create Connection
        const res = await fetch(`${API_BASE}/connections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, config })
        });
        const connData = await res.json();

        if (connData.error) throw new Error(connData.error);

        if (redirectUri) {
            // OAuth Mode: Create Session and Redirect
            const sessRes = await fetch(`${API_BASE}/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connectionId: connData.id })
            });
            const sessData = await sessRes.json();
            if (sessData.error) throw new Error(sessData.error);

            const token = sessData.accessToken;
            // Construct redirect URL
            const url = new URL(redirectUri);
            url.searchParams.set('token', token); // Using query param as requested "session data" usually implies compatibility
            if (state) url.searchParams.set('state', state);

            window.location.href = url.toString();
        } else {
            // Dashboard Mode: Return to list
            hideCreate();
            loadConnections();
        }
    } catch (e) {
        alert(e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

async function deleteConnection(id) {
    if (!confirm('Are you sure you want to delete this connection?')) return;
    await fetch(`${API_BASE}/connections/${id}`, { method: 'DELETE' });
    loadConnections();
}

async function viewConnection(id) {
    currentConnectionId = id;
    try {
        const res = await fetch(`${API_BASE}/connections/${id}`);
        const data = await res.json();

        document.getElementById('view-dashboard').classList.add('hidden');
        document.getElementById('view-detail').classList.remove('hidden');
        document.getElementById('session-output').classList.add('hidden');

        const config = data.config;
        document.getElementById('detail-content').innerHTML = `
            <div class="grid grid-cols-2 gap-x-4 gap-y-2">
                <span class="font-medium text-gray-600">Name:</span> <span class="text-gray-900">${data.name}</span>
                <span class="font-medium text-gray-600">Team ID:</span> <span class="text-gray-900">${config.teamId}</span>
                <span class="font-medium text-gray-600">Read Only:</span> <span class="text-gray-900">${config.readOnly ? 'Yes' : 'No'}</span>
                <span class="font-medium text-gray-600">Selective Write:</span> <span class="text-gray-900">${config.selectiveWrite ? 'Yes' : 'No'}</span>
            </div>
            ${config.writeSpaces?.length ? `<div class="mt-2"><span class="font-medium text-gray-600">Write Spaces:</span> <span class="text-gray-900">${config.writeSpaces.join(', ')}</span></div>` : ''}
            ${config.writeLists?.length ? `<div class="mt-2"><span class="font-medium text-gray-600">Write Lists:</span> <span class="text-gray-900">${config.writeLists.join(', ')}</span></div>` : ''}
            <div class="mt-2 text-xs text-gray-400">Created: ${new Date(data.createdAt).toLocaleString()}</div>
        `;

        loadSessions();
    } catch (e) {
        console.error(e);
        alert('Failed to load connection details');
    }
}

async function createSession() {
    if (!currentConnectionId) return;

    try {
        const res = await fetch(`${API_BASE}/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connectionId: currentConnectionId })
        });
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        document.getElementById('session-output').classList.remove('hidden');
        document.getElementById('token-display').innerText = data.accessToken;
        loadSessions();
    } catch (e) {
        alert(e.message);
    }
}

async function loadSessions() {
    if (!currentConnectionId) return;

    try {
        const res = await fetch(`${API_BASE}/connections/${currentConnectionId}/sessions`);
        const data = await res.json();

        const container = document.getElementById('session-list');
        if (data.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">No active sessions.</p>';
            return;
        }

        container.innerHTML = data.map(sess => {
            const isRevoked = sess.revoked;
            const isExpired = new Date(sess.expiresAt) < new Date();
            const status = isRevoked ? 'Revoked' : (isExpired ? 'Expired' : 'Active');
            const statusColor = isRevoked || isExpired ? 'text-gray-500' : 'text-green-600';

            return `
                <div class="flex justify-between items-center text-sm p-2 bg-white border rounded">
                    <div>
                        <span class="font-mono text-xs text-gray-600">${sess.id.substring(0, 8)}...</span>
                        <span class="ml-2 ${statusColor} font-medium">${status}</span>
                        <div class="text-xs text-gray-400">Exp: ${new Date(sess.expiresAt).toLocaleDateString()}</div>
                    </div>
                    ${!isRevoked ? `<button onclick="revokeSession('${sess.id}')" class="text-red-500 hover:text-red-700 text-xs border border-red-200 px-2 py-1 rounded">Revoke</button>` : ''}
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error(e);
    }
}

async function revokeSession(sessionId) {
    if (!confirm('Revoke this session? Client will lose access immediately.')) return;
    await fetch(`${API_BASE}/sessions/${sessionId}/revoke`, { method: 'POST' });
    loadSessions();
}

function copyToken() {
    const text = document.getElementById('token-display').innerText;
    navigator.clipboard.writeText(text).then(() => {
        alert('Copied to clipboard!');
    });
}
