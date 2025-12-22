const API_BASE = '/api';
let currentConnectionId = null;

async function loadConnections() {
    const res = await fetch(`${API_BASE}/connections`);
    if (res.status === 500) {
        const data = await res.json();
        document.getElementById('list-container').innerHTML = `<p style="color:red">Error: ${data.error}</p>`;
        return;
    }
    const data = await res.json();
    if (data.error) return alert(data.error);

    const container = document.getElementById('list-container');
    container.innerHTML = '';

    if (data.length === 0) {
        container.innerHTML = '<p>No connections found.</p>';
        return;
    }

    data.forEach(conn => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <h3>${conn.name}</h3>
            <p>ID: ${conn.id}</p>
            <button onclick="viewConnection('${conn.id}')">Manage</button>
            <button onclick="deleteConnection('${conn.id}')" style="background: #fee">Delete</button>
        `;
        container.appendChild(div);
    });
}

function showCreate() {
    document.getElementById('connection-list').classList.add('hidden');
    document.getElementById('create-form').classList.remove('hidden');
}

function hideCreate() {
    document.getElementById('create-form').classList.add('hidden');
    document.getElementById('connection-list').classList.remove('hidden');
}

async function createConnection() {
    const name = document.getElementById('conn-name').value;
    const teamId = document.getElementById('conn-teamId').value;
    const apiKey = document.getElementById('conn-apiKey').value;

    const res = await fetch(`${API_BASE}/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name,
            config: { teamId, apiKey }
        })
    });

    const data = await res.json();
    if (data.error) {
        alert(data.error);
    } else {
        hideCreate();
        loadConnections();
    }
}

async function deleteConnection(id) {
    if (!confirm('Are you sure?')) return;
    await fetch(`${API_BASE}/connections/${id}`, { method: 'DELETE' });
    loadConnections();
}

async function viewConnection(id) {
    currentConnectionId = id;
    const res = await fetch(`${API_BASE}/connections/${id}`);
    const data = await res.json();

    document.getElementById('connection-list').classList.add('hidden');
    document.getElementById('connection-detail').classList.remove('hidden');
    document.getElementById('session-output').classList.add('hidden');

    document.getElementById('detail-content').innerHTML = `
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Team ID:</strong> ${data.config.teamId}</p>
        <p><strong>Created:</strong> ${new Date(data.createdAt).toLocaleString()}</p>
    `;

    document.getElementById('mcp-url').innerText = window.location.origin + '/mcp';
    loadSessions();
}

function hideDetail() {
    document.getElementById('connection-detail').classList.add('hidden');
    document.getElementById('connection-list').classList.remove('hidden');
    currentConnectionId = null;
}

async function createSession() {
    if (!currentConnectionId) return;

    const res = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: currentConnectionId })
    });

    const data = await res.json();
    if (data.error) {
        alert(data.error);
    } else {
        document.getElementById('session-output').classList.remove('hidden');
        document.getElementById('token-display').innerText = data.accessToken;
        loadSessions();
    }
}

async function loadSessions() {
    if (!currentConnectionId) return;

    const res = await fetch(`${API_BASE}/connections/${currentConnectionId}/sessions`);
    const data = await res.json();

    const container = document.getElementById('session-list');
    if (data.length === 0) {
        container.innerHTML = '<p>No active sessions.</p>';
        return;
    }

    let html = '<table><thead><tr><th>ID</th><th>Created</th><th>Expires</th><th>Status</th><th>Action</th></tr></thead><tbody>';

    data.forEach(sess => {
        const isRevoked = sess.revoked;
        const isExpired = new Date(sess.expiresAt) < new Date();
        const status = isRevoked ? 'Revoked' : (isExpired ? 'Expired' : 'Active');
        const statusClass = isRevoked || isExpired ? 'revoked' : '';

        html += `<tr class="${statusClass}">
            <td>${sess.id.substring(0, 8)}...</td>
            <td>${new Date(sess.createdAt).toLocaleString()}</td>
            <td>${new Date(sess.expiresAt).toLocaleString()}</td>
            <td>${status}</td>
            <td>${!isRevoked ? `<button onclick="revokeSession('${sess.id}')">Revoke</button>` : ''}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

async function revokeSession(sessionId) {
    if (!confirm('Revoke this session? Client will lose access immediately.')) return;

    await fetch(`${API_BASE}/sessions/${sessionId}/revoke`, { method: 'POST' });
    loadSessions();
}

loadConnections();
