// ===================================================================================
// KONFIGURASI APLIKASI
// Nama repositori yang HARUS digunakan oleh pengguna di akun GitHub mereka.
// ===================================================================================
const REPO_CONFIG = {
    NAME: 'data-absensi-karyawan' 
};
// ===================================================================================

document.addEventListener('DOMContentLoaded', () => {
    const LS_KEYS = {
        GITHUB_TOKEN: 'absensi_github_token',
        REPO_PATH: 'absensi_repo_path',
        USER_INFO: 'absensi_user_info'
    };

    class GitHubAPI {
        constructor(token, repoPath) {
            this.token = token;
            this.repoPath = repoPath;
            this.baseUrl = `https://api.github.com/repos/${repoPath}`;
            this.headers = {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json'
            };
        }

        async getFile(filePath) {
            try {
                const response = await fetch(`${this.baseUrl}/contents/${filePath}`, { headers: this.headers });
                if (!response.ok) {
                    if (response.status === 404) return null;
                    throw new Error(`Gagal mengambil file: ${response.statusText}`);
                }
                const data = await response.json();
                const content = atob(data.content);
                return { content, sha: data.sha };
            } catch (error) {
                console.error('Error in getFile:', error);
                throw error;
            }
        }

        async updateFile(filePath, content, sha, commitMessage) {
            try {
                const response = await fetch(`${this.baseUrl}/contents/${filePath}`, {
                    method: 'PUT',
                    headers: this.headers,
                    body: JSON.stringify({
                        message: commitMessage,
                        content: btoa(content),
                        sha: sha
                    })
                });
                if (!response.ok) throw new Error(`Gagal memperbarui file: ${response.statusText}`);
                return await response.json();
            } catch (error) {
                console.error('Error in updateFile:', error);
                throw error;
            }
        }
    }

    const auth = {
        login: (token, repoPath, userInfo) => {
            localStorage.setItem(LS_KEYS.GITHUB_TOKEN, token);
            localStorage.setItem(LS_KEYS.REPO_PATH, repoPath);
            localStorage.setItem(LS_KEYS.USER_INFO, JSON.stringify(userInfo));
        },
        logout: () => {
            Object.values(LS_KEYS).forEach(key => localStorage.removeItem(key));
            window.location.href = 'index.html';
        },
        getUserInfo: () => JSON.parse(localStorage.getItem(LS_KEYS.USER_INFO)),
        getApi: () => {
            const token = localStorage.getItem(LS_KEYS.GITHUB_TOKEN);
            const repoPath = localStorage.getItem(LS_KEYS.REPO_PATH);
            if (!token || !repoPath) return null;
            return new GitHubAPI(token, repoPath);
        },
        checkAuth: (requiredRole = null) => {
            const userInfo = auth.getUserInfo();
            if (!userInfo) {
                auth.logout();
                return;
            }
            if (requiredRole && userInfo.role !== requiredRole) {
                auth.logout();
                return;
            }
            const userDisplayName = document.getElementById('user-display-name');
            if (userDisplayName) userDisplayName.textContent = userInfo.username;
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) logoutBtn.addEventListener('click', auth.logout);
        }
    };

    // ===================================================================================
    // LOGIKA HALAMAN LOGIN (index.html) - DENGAN DETEKSI OTOMATIS
    // ===================================================================================
    if (document.getElementById('login-form')) {
        const loginForm = document.getElementById('login-form');
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            Swal.fire({
                title: 'Mencoba Login...',
                text: 'Mendeteksi repositori dari token Anda...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const token = document.getElementById('github-token').value.trim();
            const appUsername = document.getElementById('username').value.trim();
            const appPassword = document.getElementById('password').value.trim();

            if (!token || !appUsername || !appPassword) {
                Swal.fire('Error', 'Semua field harus diisi!', 'error');
                return;
            }

            try {
                // Langkah 1: Gunakan token untuk mencari tahu siapa pengguna GitHub
                const userResponse = await fetch('https://api.github.com/user', {
                    headers: { 'Authorization': `token ${token}` }
                });

                if (!userResponse.ok) {
                    throw new Error('Token GitHub tidak valid atau gagal mengakses API.');
                }

                const githubUser = await userResponse.json();
                const githubUsername = githubUser.login;
                
                // Langkah 2: Bentuk path repositori secara otomatis
                const repoPath = `${githubUsername}/${REPO_CONFIG.NAME}`;
                Swal.update({ text: `Repositori terdeteksi: ${repoPath}. Memverifikasi pengguna...` });

                // Langkah 3: Lanjutkan login seperti biasa dengan path yang sudah dideteksi
                const api = new GitHubAPI(token, repoPath);
                const usersFile = await api.getFile('users.csv');

                if (!usersFile) {
                    throw new Error(`File users.csv tidak ditemukan di repositori '${repoPath}'. Pastikan nama repositori Anda adalah '${REPO_CONFIG.NAME}'.`);
                }

                const parsedUsers = Papa.parse(usersFile.content, { header: true, skipEmptyLines: true }).data;
                const user = parsedUsers.find(u => u.username === appUsername && u.password === appPassword);

                if (user) {
                    auth.login(token, repoPath, { username: user.username, role: user.role });
                    Swal.close();
                    window.location.href = user.role === 'admin' ? 'admin-dashboard.html' : 'karyawan-dashboard.html';
                } else {
                    Swal.fire('Gagal Login', 'Username atau password aplikasi salah.', 'error');
                }
            } catch (error) {
                Swal.fire('Error', `Terjadi kesalahan: ${error.message}`, 'error');
            }
        });
    }

    // ===================================================================================
    // LOGIKA DASBOR KARYAWAN & ADMIN (Tidak ada perubahan signifikan)
    // ===================================================================================
    // ... (Salin sisa kode dari file scripts.js sebelumnya di sini) ...
    // ... (Kode untuk dasbor karyawan dan admin tetap sama) ...
    if (document.getElementById('clock-in-btn')) {
        auth.checkAuth('karyawan');
        const api = auth.getApi();
        const userInfo = auth.getUserInfo();
        const clockInBtn = document.getElementById('clock-in-btn');
        const clockOutBtn = document.getElementById('clock-out-btn');
        const statusDiv = document.getElementById('current-status');
        const historyBody = document.getElementById('attendance-history-body');
        const loadingSpinner = document.getElementById('loading-spinner');

        const getTodayDateString = () => new Date().toISOString().split('T')[0];
        const getTimeString = (date) => date.toTimeString().split(' ')[0];

        const updateUI = (status, lastEntry) => {
            if (status === 'clocked-in') {
                clockInBtn.disabled = true;
                clockOutBtn.disabled = false;
                statusDiv.className = 'p-4 rounded-md text-center bg-green-100 text-green-800';
                statusDiv.innerHTML = `Anda sudah Clock In pada jam <strong>${lastEntry.jam_masuk}</strong>.`;
            } else { // clocked-out or no entry today
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
                        const jamMasuk = new Date(`${rec.tanggal}T${rec.jam_masuk}`);
                        const jamPulang = rec.jam_pulang ? new Date(`${rec.tanggal}T${rec.jam_pulang}`) : null;
                        
                        let durasi = '-';
                        if (jamPulang) {
                            const diffMs = jamPulang - jamMasuk;
                            const diffHrs = Math.floor(diffMs / 3600000);
                            const diffMins = Math.floor((diffMs % 3600000) / 60000);
                            durasi = `${diffHrs} jam ${diffMins} menit`;
                        }

                        const row = `
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${rec.tanggal}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${rec.jam_masuk}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${rec.jam_pulang || 'Belum Clock Out'}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${durasi}</td>
                            </tr>
                        `;
                        historyBody.innerHTML += row;
                    });
                } else {
                    historyBody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-gray-500">Belum ada riwayat absensi.</td></tr>';
                }

                const todayEntry = userRecords.find(r => r.tanggal === getTodayDateString());
                if (todayEntry && !todayEntry.jam_pulang) {
                    updateUI('clocked-in', todayEntry);
                } else {
                    updateUI('clocked-out', null);
                }
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
                    records.push({
                        username: userInfo.username,
                        tanggal: today,
                        jam_masuk: currentTime,
                        jam_pulang: ''
                    });
                } else { // out
                    const recordToUpdate = records.find(r => r.username === userInfo.username && r.tanggal === today && !r.jam_pulang);
                    if (recordToUpdate) {
                        recordToUpdate.jam_pulang = currentTime;
                    }
                }

                const newCsvContent = Papa.unparse(records, { header: true });
                await api.updateFile('absensi.csv', newCsvContent, sha, `[Absensi] ${type === 'in' ? 'Clock In' : 'Clock Out'} oleh ${userInfo.username}`);

                Swal.fire('Berhasil!', `Anda berhasil melakukan ${type === 'in' ? 'Clock In' : 'Clock Out'}.`, 'success');
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

    if (document.getElementById('tab-btn-attendance')) {
        auth.checkAuth('admin');
        const api = auth.getApi();
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
                    title: 'Anda yakin?',
                    text: `Pengguna "${username}" akan dihapus!`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#3085d6',
                    confirmButtonText: 'Ya, hapus!'
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
