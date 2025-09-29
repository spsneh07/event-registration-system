(() => {
    // --- CONFIG ---
    const API_BASE_URL = 'https://eventsphere-register.onrender.com'; // Change if your backend URL is different

    // --- UI References ---
    const getEl = (id) => document.getElementById(id);

    // Views & Navigation
    const views = {
        home: getEl('view-home'),
        register: getEl('view-register'),
        admin: getEl('view-admin'),
    };
    const tabs = {
        home: getEl('tab-home'),
        register: getEl('tab-register'),
        admin: getEl('tab-admin'),
    };
    const goToRegisterBtn = getEl('go-to-register-btn');

    // Registration Form
    const regForm = getEl('registration-form');
    const regBtn = getEl('register-btn');
    const clearRegBtn = getEl('clear-reg');
    const regError = getEl('reg-error');
    const qrcodeArea = getEl('qrcode-area');
    const qrcodeEl = getEl('qrcode');
    const displayName = getEl('display-name');
    const displayEmail = getEl('display-email');
    const displayId = getEl('display-id');
    const downloadQrBtn = getEl('download-qr');
    const regAnother = getEl('reg-another');

    // Admin Views
    const adminLoginView = getEl('admin-login-view');
    const adminDashboardView = getEl('admin-dashboard-view');

    // Admin Login
    const loginForm = getEl('login-form');
    const loginBtn = getEl('login-btn');
    const loginError = getEl('login-error');
    const logoutBtn = getEl('logout-btn');

    // Admin Dashboard
    const statsCheckedIn = getEl('stats-checked-in');
    const statsTotal = getEl('stats-total');
    const btnStart = getEl('btn-start');
    const btnStop = getEl('btn-stop');
    const readerEl = getEl('reader');
    const scanStatus = getEl('scan-status');
    const refreshBtn = getEl('refresh-btn');
    const exportBtn = getEl('export-btn');
    const participantsTable = getEl('participants-table');
    const adminError = getEl('admin-error');

    // --- State ---
    let participantsCache = [];
    let currentQrCanvas = null;
    let html5QrCode = null;
    let scanning = false;
    let lastScanTime = 0;

    // --- Helper Functions ---
    const setBusy = (el, busy = true, text = '') => {
        if (!el) return;
        el.disabled = busy;
        if (busy && text) {
            el.dataset.originalText = el.textContent;
            el.textContent = text;
        } else if (!busy && el.dataset.originalText) {
            el.textContent = el.dataset.originalText;
        }
    };

    const safeFetch = async (url, options = {}) => {
        options.credentials = 'include'; // Send cookies with every request
        const response = await fetch(url, options);
        let data;
        try {
            data = await response.json();
        } catch (e) {
            data = { error: 'Received non-JSON response from server.' };
        }
        if (!response.ok) {
            throw new Error(data.error || `Request failed with status ${response.status}`);
        }
        return data;
    };

    // --- View Switching ---
    const switchView = async (viewName) => {
        Object.values(views).forEach(view => view.classList.add('hidden'));
        Object.values(tabs).forEach(tab => tab.classList.remove('active', 'bg-blue-600', 'text-white'));
        
        views[viewName].classList.remove('hidden');
        tabs[viewName].classList.add('active', 'bg-blue-600', 'text-white');
        
        if (viewName === 'admin') {
            await checkSessionAndShowAdminView();
        } else if (scanning) {
            await stopScanner();
        }
    };

    // --- Authentication ---
    const checkSessionAndShowAdminView = async () => {
        try {
            await safeFetch(`${API_BASE_URL}/session`);
            showAdminDashboard();
        } catch (error) {
            showAdminLogin();
        }
    };

    const showAdminLogin = () => {
        adminLoginView.classList.remove('hidden');
        adminDashboardView.classList.add('hidden');
    };

    const showAdminDashboard = () => {
        adminLoginView.classList.add('hidden');
        adminDashboardView.classList.remove('hidden');
        fetchParticipants();
        fetchStats();
    };

    // --- Registration Logic ---
    regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        regError.classList.add('hidden');
        setBusy(regBtn, true, 'Generating...');
        try {
            const data = await safeFetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: regForm.name.value, email: regForm.email.value }),
            });
            qrcodeEl.innerHTML = '';
            new QRCode(qrcodeEl, { text: data.registration_id, width: 160, height: 160 });
            currentQrCanvas = qrcodeEl.querySelector('canvas') || qrcodeEl.querySelector('img');
            displayName.textContent = data.name;
            displayEmail.textContent = data.email;
            displayId.textContent = data.registration_id;
            qrcodeArea.classList.remove('hidden');
        } catch (error) {
            regError.textContent = error.message;
            regError.classList.remove('hidden');
        } finally {
            setBusy(regBtn, false);
        }
    });

    // --- Admin Logic ---
    const fetchParticipants = async () => {
        adminError.classList.add('hidden');
        participantsTable.innerHTML = `<tr><td colspan="3" class="px-4 py-6 text-center text-gray-400">Loading...</td></tr>`;
        try {
            const data = await safeFetch(`${API_BASE_URL}/participants`);
            participantsCache = Array.isArray(data) ? data : [];
            renderParticipants(participantsCache);
        } catch (error) {
            participantsTable.innerHTML = `<tr><td colspan="3" class="px-4 py-6 text-center text-red-400">Could not load data.</td></tr>`;
            adminError.textContent = error.message;
            adminError.classList.remove('hidden');
        }
    };
    
    const fetchStats = async () => {
        try {
            const data = await safeFetch(`${API_BASE_URL}/stats`);
            statsCheckedIn.textContent = data.checked_in || 0;
            statsTotal.textContent = data.total || 0;
        } catch (error) {
            console.error("Failed to fetch stats:", error);
        }
    };

    const renderParticipants = (list) => {
        participantsTable.innerHTML = '';
        if (!list || list.length === 0) {
            participantsTable.innerHTML = `<tr><td colspan="3" class="px-4 py-6 text-center text-gray-400">No participants yet.</td></tr>`;
            return;
        }
        list.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-3 py-2">${p.name || '-'}</td>
                <td class="px-3 py-2">${p.attended ? '<span class="text-green-400">✅ Checked In</span>' : '<span class="text-yellow-400">❌ Not In</span>'}</td>
                <td class="px-3 py-2">
                    ${!p.attended ? `<button data-id="${p.registration_id}" class="manual-checkin-btn bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs">Check In</button>` : '-'}
                </td>
            `;
            participantsTable.appendChild(tr);
        });
    };
    
    const manualCheckIn = async (regId, btn) => {
        setBusy(btn, true, '...');
        try {
            const data = await safeFetch(`${API_BASE_URL}/checkin/${encodeURIComponent(regId)}`, { method: 'POST' });
            await fetchParticipants(); // Refresh list on success
            await fetchStats();
        } catch (error) {
            alert(`Check-in failed: ${error.message}`);
        } finally {
            setBusy(btn, false);
        }
    };

    const startScanner = async () => {
        if (scanning) return;
        setBusy(btnStart, true);
        btnStop.disabled = false;
        scanStatus.textContent = 'Starting camera...';
        html5QrCode = new Html5Qrcode("reader");
        try {
            await html5QrCode.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                onScanSuccess,
                (errorMessage) => {}
            );
            scanning = true;
            scanStatus.textContent = 'Scanning...';
        } catch (err) {
            scanStatus.textContent = 'Error starting camera.';
            console.error(err);
        } finally {
            setBusy(btnStart, false);
        }
    };
    
    const stopScanner = async () => {
        if (!scanning) return;
        setBusy(btnStop, true);
        try {
            await html5QrCode.stop();
            scanning = false;
            scanStatus.textContent = 'Scanner stopped.';
        } catch (err) {
            console.error("Failed to stop scanner:", err);
        } finally {
            setBusy(btnStop, false);
            btnStop.disabled = true;
        }
    };
    
    const onScanSuccess = async (decodedText) => {
        const now = Date.now();
        if (now - lastScanTime < 3000) return; // Debounce scans
        lastScanTime = now;
        
        scanStatus.textContent = `Checking in: ${decodedText.substring(0, 10)}...`;
        try {
            const data = await safeFetch(`${API_BASE_URL}/checkin/${encodeURIComponent(decodedText)}`, { method: 'POST' });
            scanStatus.textContent = `✅ Success: ${data.message}`;
            await fetchParticipants();
            await fetchStats();
        } catch (error) {
            scanStatus.textContent = `❌ Error: ${error.message}`;
        }
    };

    // --- Event Listeners ---
    // Navigation
    tabs.home.addEventListener('click', () => switchView('home'));
    tabs.register.addEventListener('click', () => switchView('register'));
    tabs.admin.addEventListener('click', () => switchView('admin'));
    goToRegisterBtn.addEventListener('click', () => switchView('register'));

    // Registration
    clearRegBtn.addEventListener('click', () => {
        regForm.reset();
        qrcodeArea.classList.add('hidden');
        regError.classList.add('hidden');
    });
    regAnother.addEventListener('click', () => {
        regForm.reset();
        qrcodeArea.classList.add('hidden');
    });
    downloadQrBtn.addEventListener('click', () => {
        if (!currentQrCanvas) return;
        const link = document.createElement('a');
        link.download = 'registration-qr-code.png';
        link.href = currentQrCanvas.toDataURL('image/png');
        link.click();
    });

    // Admin Login/Logout
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setBusy(loginBtn, true, 'Logging In...');
        loginError.classList.add('hidden');
        try {
            await safeFetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: loginForm.username.value, password: loginForm.password.value })
            });
            showAdminDashboard();
        } catch (error) {
            loginError.textContent = error.message;
            loginError.classList.remove('hidden');
        } finally {
            setBusy(loginBtn, false);
        }
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            await safeFetch(`${API_BASE_URL}/logout`, { method: 'POST' });
            if (scanning) await stopScanner();
            showAdminLogin();
        } catch (error) {
            alert('Logout failed: ' + error.message);
        }
    });

    // Admin Dashboard Actions
    refreshBtn.addEventListener('click', () => {
        fetchParticipants();
        fetchStats();
    });
    btnStart.addEventListener('click', startScanner);
    btnStop.addEventListener('click', stopScanner);
    participantsTable.addEventListener('click', (e) => {
        if (e.target.classList.contains('manual-checkin-btn')) {
            manualCheckIn(e.target.dataset.id, e.target);
        }
    });
    exportBtn.addEventListener('click', () => {
        if (participantsCache.length === 0) return alert('No data to export.');
        const sheetData = participantsCache.map(p => ({
            Name: p.name,
            Email: p.email,
            CheckedIn: p.attended ? 'Yes' : 'No',
            CheckInTime: p.timestamp ? new Date(p.timestamp).toLocaleString() : '',
            RegistrationID: p.registration_id
        }));
        const ws = XLSX.utils.json_to_sheet(sheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Participants");
        XLSX.writeFile(wb, "EventSphere_Participants.xlsx");
    });

    // --- Initial Load ---
    switchView('home');

})();