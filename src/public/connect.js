document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const fields = ['redirect_uri', 'state', 'code_challenge', 'code_challenge_method'];
    fields.forEach(f => {
        const val = params.get(f);
        if (val) document.getElementById(f).value = val;
    });
});

document.getElementById('connect-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const err = document.getElementById('error-msg');

    btn.disabled = true;
    btn.innerText = 'Connecting...';
    err.classList.add('hidden');
    err.innerText = '';

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    // Transform arrays/booleans
    const payload = {
        redirect_uri: data.redirect_uri,
        state: data.state,
        code_challenge: data.code_challenge,
        code_challenge_method: data.code_challenge_method,
        csrf_token: data.csrf_token,
        name: data.name,
        config: {
            apiKey: data.apiKey,
            readOnly: document.getElementById('readOnly').checked,
            selectiveWrite: document.getElementById('selectiveWrite').checked,
            writeSpaces: data.writeSpaces ? data.writeSpaces.split(',').map(s => s.trim()).filter(Boolean) : [],
            writeLists: data.writeLists ? data.writeLists.split(',').map(s => s.trim()).filter(Boolean) : []
        }
    };

    try {
        const res = await fetch('/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await res.json();

        if (res.ok && result.redirectUrl) {
            window.location.href = result.redirectUrl;
        } else {
            throw new Error(result.error || 'Connection failed');
        }
    } catch (e) {
        err.innerText = e.message;
        err.classList.remove('hidden');
        btn.disabled = false;
        btn.innerText = 'Connect';
    }
});
