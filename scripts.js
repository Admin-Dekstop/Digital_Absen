// ===================================================================================
// KONFIGURASI APLIKASI
// PENTING: Saya sudah mengisi nilai di bawah ini dengan data Anda.
// ===================================================================================
const CONFIG = {
    // INI SUDAH SAYA ISI DENGAN TOKEN YANG ANDA BERIKAN.
    // INGAT UNTUK MENGHAPUS TOKEN INI DAN MEMBUAT YANG BARU SETELAH SEMUANYA BERHASIL.
    GITHUB_TOKEN: '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',

    // Path repositori Anda. INI JUGA SUDAH BENAR.
    REPO_PATH: 'kantor-absensi-bot/data-absensi-karyawan'
};
// ===================================================================================

document.addEventListener('DOMContentLoaded', () => {
    const LS_KEYS = { USER_INFO: 'absensi_user_info' };

    class GitHubAPI {
        constructor(token, repoPath) {
            this.token = token;
            this.repoPath = repoPath;
            this.headers = { 'Authorization': `token ${this.token}`, 'Accept': 'application/vnd.github.v3+json' };
        }

        async getFile(filePath) {
            const url = `https://api.github.com/repos/${this.repoPath}/contents/${filePath}`;
            try {
                const response = await fetch(url, { headers: this.headers, cache: 'no-store' });
                if (!response.ok) {
                    if (response.status === 404) return null;
                    throw new Error(`Gagal mengambil file: ${response.statusText}`);
                }
                const data = await response.json();
                return { content: atob(data.content), sha: data.sha };
            } catch (error) {
                console.error(`Error fetching ${filePath}:`, error);
                throw error;
            }
        }

        async updateFile(filePath, newContent, sha, commitMessage) {
            const url = `https://api.github.com/repos/${this.repoPath}/contents/${filePath}`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: this.headers,
                body: JSON.stringify({ message: commitMessage, content: btoa(newContent), sha: sha })
            });
            if (!response.ok) throw new Error(`Gagal memperbarui file: ${response.statusText}`);
        }
    }

    const auth = {
        login: (userInfo) => {
            localStorage.setItem(LS_KEYS.USER_INFO, JSON.stringify(userInfo));
            window.location.href = userInfo.role === 'admin' ? 'admin-dashboard.html' : 'karyawan-dashboard.html';
        },
        logout: () => {
            localStorage.removeItem(LS_KEYS.USER_INFO);
            window.location.href = 'index.html';
        },
        getUserInfo: () => JSON.parse(localStorage.getItem(LS_KEYS.USER_INFO)),
        getApi: () => {
            // Logika pengecekan diubah agar tidak error jika token asli mengandung 'GANTI_'
            if (!CONFIG.GITHUB_TOKEN || CONFIG.GITHUB_TOKEN.length < 20) {
                return null;
            }
            return new GitHubAPI(CONFIG.GITHUB_TOKEN, CONFIG.REPO_PATH);
        },
        checkAuth: (requiredRole = null) => {
            const userInfo = auth.getUserInfo();
            if (!userInfo || (requiredRole && userInfo.role !== requiredRole)) {
                auth.logout();
                return null;
            }
            const userDisplayName = document.getElementById('user-display-name');
            if (userDisplayName) userDisplayName.textContent = userInfo.username;
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) logoutBtn.addEventListener('click', auth.logout);
            return userInfo;
        }
    };

    const api = auth.getApi();
    const isLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/');
    if (!api && !isLoginPage) {
        // Pesan error ini yang muncul jika token tidak valid atau kosong
        Swal.fire('Error Konfigurasi', 'Aplikasi belum di-setup oleh admin. Cek `scripts.js`', 'error');
        window.location.href = 'index.html';
        return;
    }

    if (document.getElementById('login-form')) {
        const loginView = document.getElementById('login-view');
        const registerView = document.getElementById('register-view');
        
        document.getElementById('show-register-view').addEventListener('click', (e) => {
            e.preventDefault();
            loginView.classList.add('hidden');
            registerView.classList.remove('hidden');
        });

        document.getElementById('show-login-view').addEventListener('click', (e) => {
            e.preventDefault();
            registerView.classList.add('hidden');
            loginView.classList.remove('hidden');
        });

        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!api) {
                Swal.fire('Error Konfigurasi', 'Aplikasi belum di-setup oleh admin.', 'error');
                return;
            }
            Swal.fire({ title: 'Mencoba Login...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;

            try {
                const file = await api.getFile('users.csv');
                if (!file) throw new Error('File data pengguna (users.csv) tidak ditemukan di repositori. Hubungi admin.');
                
                const users = Papa.parse(file.content, { header: true, skipEmptyLines: true }).data;
                const user = users.find(u => u.username === username && u.password === password);

                if (user) {
                    Swal.close();
                    auth.login({ username: user.username, role: user.role });
                } else {
                    Swal.fire('Gagal', 'Username atau password salah.', 'error');
                }
            } catch (error) {
                Swal.fire('Error', `Terjadi kesalahan: ${error.message}`, 'error');
            }
        });

        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!api) {
                Swal.fire('Error Konfigurasi', 'Aplikasi belum di-setup oleh admin.', 'error');
                return;
            }
            
            const username = document.getElementById('register-username').value;
            const password = document.getElementById('register-password').value;
            const confirmPassword = document.getElementById('register-password-confirm').value;

            if (password !== confirmPassword) {
                Swal.fire('Gagal', 'Password dan konfirmasi password tidak cocok.', 'error');
                return;
            }
            
            Swal.fire({ title: 'Mendaftarkan akun...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            try {
                const file = await api.getFile('users.csv');
                if (!file) throw new Error('File data pengguna tidak ditemukan. Hubungi admin.');

                const users = Papa.parse(file.content, { header: true, skipEmptyLines: true }).data;
                if (users.some(u => u.username === username)) {
                    Swal.fire('Gagal', 'Username sudah digunakan. Silakan pilih yang lain.', 'error');
                    return;
                }

                users.push({ username: username, password: password, role: 'karyawan' });
                const newCsvContent = Papa.unparse(users);
                await api.updateFile('users.csv', newCsvContent, file.sha, `[Sistem] Mendaftarkan pengguna baru: ${username}`);
                
                Swal.fire('Berhasil!', 'Akun Anda berhasil dibuat. Silakan login.', 'success').then(() => {
                    document.getElementById('show-login-view').click();
                    document.getElementById('register-form').reset();
                });

            } catch (error) {
                Swal.fire('Error', `Gagal mendaftar: ${error.message}`, 'error');
            }
        });
    }

    // Sisa kode untuk dasbor karyawan dan admin tidak berubah
    // ... (kode dari file sebelumnya)
    if (document.getElementById('clock-in-btn')) {
        const userInfo = auth.checkAuth('karyawan');
        if (!userInfo) return;

        const clockInBtn = document.getElementById('clock-in-btn');
        const clockOutBtn = document.getElementById('clock-out-btn');
        const statusDiv = document.getElementById('current-status');
        const historyBody = document.getElementById('attendance-history-body');
        const loadingSpinner = document.getElementById('loading-spinner');

        const getTodayDateString = () => new Date().toLocaleDateString('en-CA');
        const getTimeString = (date) => date.toTimeString().split(' ')[0];

        const updateUI = (status, lastEntry) => {
            if (status === 'clocked-in') {
                clockInBtn.disabled = true;
                clockOutBtn.disabled = false;
                statusDiv.className = 'p-4 rounded-md text-center bg-green-100 text-green-800';
                statusDiv.innerHTML = `Anda sudah Clock In pada jam <strong>${lastEntry.jam_masuk}</strong>.`;
            } else {
                clockInBtn.disabled = false;
                clockOutBtn.disabled = true;
                statusDiv.className = 'p-4 rounded-md text-center bg-blue-100 text-blue-800';
                statusDiv.innerHTML = 'Anda belum melakukan absensi hari ini.';
            }
        };

        const loadAttendance = async () => {
            try {
                const file = await api.getFile('absensi.csv');
                const records = file ? Papa.parse(file.content, { header: true, skipEmptyLines: true }).data : [];
                
                const userRecords = records.filter(r => r.username === userInfo.username).reverse();
                
                historyBody.innerHTML = '';
                if (userRecords.length > 0) {
                    userRecords.forEach(rec => {
                        const row = `
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${rec.tanggal}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${rec.jam_masuk}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${rec.jam_pulang || 'Belum Clock Out'}</td>
                            </tr>
                        `;
                        historyBody.innerHTML += row;
                    });
                } else {
                    historyBody.innerHTML = '<tr><td colspan="3" class="text-center p-4 text-gray-500">Belum ada riwayat absensi.</td></tr>';
                }

                const todayEntry = userRecords.find(r => r.tanggal === getTodayDateString() && !r.jam_pulang);
                updateUI(todayEntry ? 'clocked-in' : 'clocked-out', todayEntry);

            } catch (error) {
                Swal.fire('Error', `Gagal memuat data absensi: ${error.message}`, 'error');
            }
        };
        
        const performClocking = async (type) => {
            loadingSpinner.classList.remove('hidden');
            clockInBtn.disabled = true;
            clockOutBtn.disabled = true;

            try {
                const file = await api.getFile('absensi.csv');
                let records = file ? Papa.parse(file.content, { header: true, skipEmptyLines: true }).data : [];
                const sha = file ? file.sha : null;
                const now = new Date();
                const today = getTodayDateString();
                const currentTime = getTimeString(now);

                if (type === 'in') {
                    records.push({ username: userInfo.username, tanggal: today, jam_masuk: currentTime, jam_pulang: '' });
                } else {
                    const recordToUpdate = records.find(r => r.username === userInfo.username && r.tanggal === today && !r.jam_pulang);
                    if (recordToUpdate) recordToUpdate.jam_pulang = currentTime;
                }

                const newCsvContent = Papa.unparse(records, { header: true });
                await api.updateFile('absensi.csv', newCsvContent, sha, `[Absensi] ${type} oleh ${userInfo.username}`);
                Swal.fire('Berhasil!', `Anda berhasil ${type === 'in' ? 'Clock In' : 'Clock Out'}.`, 'success');
                await loadAttendance();
            } catch (error) {
                 Swal.fire('Error', `Gagal menyimpan data: ${error.message}`, 'error');
            } finally {
                loadingSpinner.classList.add('hidden');
            }
        };

        clockInBtn.addEventListener('click', () => performClocking('in'));
        clockOutBtn.addEventListener('click', () => performClocking('out'));

        loadAttendance();
    }
    
    if (document.getElementById('tab-btn-users')) {
        auth.checkAuth('admin');
        let allUsers = [];
        let allAttendance = [];

        const tabs = {
            attendance: { btn: document.getElementById('tab-btn-attendance'), content: document.getElementById('tab-content-attendance') },
            users: { btn: document.getElementById('tab-btn-users'), content: document.getElementById('tab-content-users') }
        };

        const switchTab = (tabName) => {
            Object.values(tabs).forEach(tab => {
                tab.btn.classList.remove('active');
                tab.content.classList.add('hidden');
            });
            tabs[tabName].btn.classList.add('active');
            tabs[tabName].content.classList.remove('hidden');
        };
        
        tabs.attendance.btn.addEventListener('click', () => switchTab('attendance'));
        tabs.users.btn.addEventListener('click', () => switchTab('users'));
        
        const usersTableBody = document.getElementById('users-table-body');
        const renderUsers = () => {
            usersTableBody.innerHTML = '';
            allUsers.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${user.username}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.role}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button class="text-indigo-600 hover:text-indigo-900 edit-user-btn" data-username="${user.username}">Edit</button>
                        <button class="text-red-600 hover:text-red-900 ml-4 delete-user-btn" data-username="${user.username}">Hapus</button>
                    </td>
                `;
                usersTableBody.appendChild(row);
            });
        };

        const loadUsers = async () => {
            try {
                const file = await api.getFile('users.csv');
                allUsers = file ? Papa.parse(file.content, { header: true, skipEmptyLines: true }).data : [];
                renderUsers();
            } catch (error) {
                Swal.fire('Error', `Gagal memuat pengguna: ${error.message}`, 'error');
            }
        };

        const saveUsers = async (commitMessage) => {
            try {
                const { sha } = await api.getFile('users.csv');
                const newCsvContent = Papa.unparse(allUsers, { header: true });
                await api.updateFile('users.csv', newCsvContent, sha, commitMessage);
                Swal.fire('Sukses', 'Data pengguna berhasil diperbarui.', 'success');
                await loadUsers();
            } catch (error) {
                Swal.fire('Error', `Gagal menyimpan pengguna: ${error.message}`, 'error');
            }
        };
        
        document.getElementById('add-user-btn').addEventListener('click', async () => {
            const { value: formValues } = await Swal.fire({
                title: 'Tambah Pengguna Baru',
                html:
                    '<input id="swal-input1" class="swal2-input" placeholder="Username">' +
                    '<input id="swal-input2" class="swal2-input" placeholder="Password" type="password">' +
                    '<select id="swal-input3" class="swal2-select"><option value="karyawan">Karyawan</option><option value="admin">Admin</option></select>',
                focusConfirm: false,
                preConfirm: () => [
                    document.getElementById('swal-input1').value,
                    document.getElementById('swal-input2').value,
                    document.getElementById('swal-input3').value
                ]
            });

            if (formValues) {
                const [username, password, role] = formValues;
                if (!username || !password) {
                    Swal.fire('Gagal', 'Username dan password tidak boleh kosong.', 'error');
                    return;
                }
                if (allUsers.some(u => u.username === username)) {
                    Swal.fire('Gagal', 'Username sudah ada.', 'error');
                    return;
                }
                allUsers.push({ username, password, role });
                await saveUsers(`[Admin] Menambah pengguna ${username}`);
            }
        });

        usersTableBody.addEventListener('click', async (e) => {
            const username = e.target.dataset.username;
            if (!username) return;

            if (e.target.classList.contains('delete-user-btn')) {
                Swal.fire({
                    title: 'Anda yakin?', text: `Pengguna "${username}" akan dihapus!`, icon: 'warning',
                    showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya, hapus!'
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        allUsers = allUsers.filter(u => u.username !== username);
                        await saveUsers(`[Admin] Menghapus pengguna ${username}`);
                    }
                });
            }

            if (e.target.classList.contains('edit-user-btn')) {
                const user = allUsers.find(u => u.username === username);
                const { value: formValues } = await Swal.fire({
                    title: `Edit Pengguna: ${username}`,
                    html:
                        `<input id="swal-input1" class="swal2-input" placeholder="Password baru (kosongkan jika tidak berubah)">` +
                        `<select id="swal-input2" class="swal2-select">
                            <option value="karyawan" ${user.role === 'karyawan' ? 'selected' : ''}>Karyawan</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                         </select>`,
                    focusConfirm: false,
                    preConfirm: () => [document.getElementById('swal-input1').value, document.getElementById('swal-input2').value]
                });

                if (formValues) {
                    const [newPassword, newRole] = formValues;
                    const userToUpdate = allUsers.find(u => u.username === username);
                    if (newPassword) userToUpdate.password = newPassword;
                    userToUpdate.role = newRole;
                    await saveUsers(`[Admin] Mengedit pengguna ${username}`);
                }
            }
        });
        
        const attendanceBody = document.getElementById('all-attendance-body');
        const renderAttendance = (filteredData) => {
            attendanceBody.innerHTML = '';
            if (filteredData.length === 0) {
                attendanceBody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-gray-500">Tidak ada data yang cocok.</td></tr>';
                return;
            }
            filteredData.forEach(rec => {
                const row = `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${rec.username}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${rec.tanggal}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${rec.jam_masuk}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${rec.jam_pulang || '-'}</td>
                    </tr>
                `;
                attendanceBody.innerHTML += row;
            });
        };

        const loadAttendance = async () => {
            try {
                const file = await api.getFile('absensi.csv');
                allAttendance = file ? Papa.parse(file.content, { header: true, skipEmptyLines: true }).data : [];
                renderAttendance(allAttendance);
            } catch (error) {
                Swal.fire('Error', `Gagal memuat absensi: ${error.message}`, 'error');
            }
        };

        const filterNameInput = document.getElementById('filter-name');
        const filterDateInput = document.getElementById('filter-date');
        const applyFilters = () => {
            let filtered = allAttendance;
            const nameQuery = filterNameInput.value.toLowerCase();
            const dateQuery = filterDateInput.value;

            if (nameQuery) {
                filtered = filtered.filter(rec => rec.username.toLowerCase().includes(nameQuery));
            }
            if (dateQuery) {
                filtered = filtered.filter(rec => rec.tanggal === dateQuery);
            }
            renderAttendance(filtered);
        };
        filterNameInput.addEventListener('input', applyFilters);
        filterDateInput.addEventListener('change', applyFilters);

        document.getElementById('export-excel-btn').addEventListener('click', () => {
            const table = document.getElementById('attendance-table');
            const wb = XLSX.utils.table_to_book(table, { sheet: "Laporan Absensi" });
            XLSX.writeFile(wb, "Laporan_Absensi.xlsx");
        });

        document.getElementById('export-pdf-btn').addEventListener('click', () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.autoTable({ html: '#attendance-table' });
            doc.save('Laporan_Absensi.pdf');
        });

        loadUsers();
        loadAttendance();
    }
});
