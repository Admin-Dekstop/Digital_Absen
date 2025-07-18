// ===================================================================================
// KONFIGURASI APLIKASI
// PENTING: Isi semua nilai di bawah ini!
// ===================================================================================
const CONFIG = {
    // Masukkan Personal Access Token (PAT) dari akun "bot" GitHub Anda di sini.
    // Token ini akan terlihat di kode sumber, jadi PASTIKAN token ini hanya memiliki
    // akses ke repositori data absensi saja.
    GITHUB_TOKEN: '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', // Contoh: ghp_xxxxxxxxxxxxxx

    // Masukkan path repositori dalam format 'username/nama-repo'.
    // Gunakan username dari akun "bot" Anda.
    REPO_PATH: 'username-bot/nama-repo-data' // Contoh: kantor-absensi-bot/data-absensi-karyawan
};
// ===================================================================================

document.addEventListener('DOMContentLoaded', () => {
    const LS_KEYS = { USER_INFO: 'absensi_user_info' };

    // API Helper Class
    class GitHubAPI {
        constructor(token, repoPath) {
            this.token = token;
            this.repoPath = repoPath;
            this.headers = { 'Authorization': `token ${this.token}`, 'Accept': 'application/vnd.github.v3+json' };
        }

        async getFile(filePath) {
            const url = `https://api.github.com/repos/${this.repoPath}/contents/${filePath}`;
            try {
                const response = await fetch(url, { headers: this.headers, cache: 'no-store' }); // no-store untuk data terbaru
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

    // Auth & Utility Functions
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
            if (CONFIG.GITHUB_TOKEN.startsWith('GANTI_') || CONFIG.REPO_PATH.startsWith('username-bot')) {
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

    // --- Universal API instance check ---
    const api = auth.getApi();
    if (!api && window.location.pathname.includes('dashboard')) {
        alert('Aplikasi belum dikonfigurasi! Harap hubungi admin untuk mengisi Token dan Path Repositori di scripts.js.');
        return;
    }

    // ===================================================================================
    // HALAMAN LOGIN & REGISTRASI (index.html)
    // ===================================================================================
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

        // Login Logic
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
                if (!file) throw new Error('File data pengguna tidak ditemukan. Hubungi admin.');
                
                const users = Papa.parse(file.content, { header: true, skipEmptyLines: true }).data;
                const user = users.find(u => u.username === username && u.password === password);

                if (user) {
                    Swal.close();
                    auth.login({ username: user.username, role: user.role });
                } else {
                    Swal.fire('Gagal', 'Username atau password salah.', 'error');
                }
            } catch (error) {
                Swal.fire('Error', error.message, 'error');
            }
        });

        // Register Logic
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

    // ===================================================================================
    // DASBOR KARYAWAN (karyawan-dashboard.html)
    // ===================================================================================
    if (document.getElementById('clock-in-btn')) {
        const userInfo = auth.checkAuth('karyawan');
        if (!userInfo) return;

        const clockInBtn = document.getElementById('clock-in-btn');
        const clockOutBtn = document.getElementById('clock-out-btn');
        const statusDiv = document.getElementById('current-status');
        const historyBody = document.getElementById('attendance-history-body');
        const loadingSpinner = document.getElementById('loading-spinner');

        const getTodayDateString = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
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
                        const durasi = rec.jam_pulang ? 'Selesai' : 'Berlangsung'; // Simplified duration
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
    
    // Sisa kode untuk Dasbor Admin bisa ditambahkan di sini (tidak berubah dari versi sebelumnya, tanpa tombol sinkronisasi)
    // ...
});
