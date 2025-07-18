// ===================================================================================
// KONFIGURASI FIREBASE
// PENTING: Salin dan tempel objek konfigurasi Firebase Anda di sini.
// Anda mendapatkannya dari Langkah 1.3.
// ===================================================================================
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCOEDrWyOrubRUHXY0AouAiXvR294FcUbQ",
  authDomain: "data-absen-f5595.firebaseapp.com",
  projectId: "data-absen-f5595",
  storageBucket: "data-absen-f5595.firebasestorage.app",
  messagingSenderId: "357673916959",
  appId: "1:357673916959:web:2bae1e5ab3f19cb5ca932a",
  measurementId: "G-DGHTWY3GPG"
};
// ===================================================================================

// Import fungsi-fungsi yang kita butuhkan dari Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Fungsi Helper ---
const showLoading = (title) => Swal.fire({ title, allowOutsideClick: false, didOpen: () => Swal.showLoading() });
const hideLoading = () => Swal.close();
const showAlert = (title, text, icon) => Swal.fire(title, text, icon);

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

    // Cek jika pengguna sudah login, langsung arahkan
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            showLoading('Memverifikasi pengguna...');
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                window.location.href = userData.role === 'admin' ? 'admin-dashboard.html' : 'karyawan-dashboard.html';
            }
        }
    });

    // Logika Login
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading('Mencoba login...');
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged akan menangani pengalihan halaman
        } catch (error) {
            hideLoading();
            showAlert('Gagal Login', error.message, 'error');
        }
    });

    // Logika Registrasi
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading('Mendaftarkan akun...');
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Simpan data tambahan pengguna di Firestore
            await setDoc(doc(db, "users", user.uid), {
                username: username,
                email: email,
                role: 'karyawan' // Semua yang mendaftar otomatis jadi karyawan
            });

            hideLoading();
            showAlert('Berhasil!', 'Akun Anda berhasil dibuat. Silakan login.', 'success');
            document.getElementById('show-login-view').click();
        } catch (error) {
            hideLoading();
            showAlert('Gagal Mendaftar', error.message, 'error');
        }
    });
}

// ===================================================================================
// FUNGSI UMUM UNTUK HALAMAN DASBOR
// ===================================================================================
const handleDashboardPage = (requiredRole) => {
    const userDisplayName = document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('logout-btn');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.role !== requiredRole) {
                    showAlert('Akses Ditolak', 'Anda tidak memiliki izin untuk mengakses halaman ini.', 'error');
                    window.location.href = 'index.html';
                    return;
                }
                userDisplayName.textContent = userData.username;
                // Jalankan fungsi spesifik halaman setelah user terverifikasi
                if (requiredRole === 'karyawan') initKaryawanPage(user, userData);
                if (requiredRole === 'admin') initAdminPage(user, userData);
            } else {
                // Dokumen user tidak ada, mungkin kesalahan saat registrasi
                showAlert('Error', 'Data pengguna tidak ditemukan.', 'error');
                signOut(auth);
            }
        } else {
            // Pengguna tidak login
            window.location.href = 'index.html';
        }
    });

    logoutBtn.addEventListener('click', () => {
        signOut(auth);
    });
};

// ===================================================================================
// HALAMAN DASBOR KARYAWAN
// ===================================================================================
if (window.location.pathname.includes('karyawan-dashboard.html')) {
    handleDashboardPage('karyawan');
}

function initKaryawanPage(user, userData) {
    const clockInBtn = document.getElementById('clock-in-btn');
    const clockOutBtn = document.getElementById('clock-out-btn');
    const statusDiv = document.getElementById('current-status');
    const historyBody = document.getElementById('attendance-history-body');

    const getTodayDateString = () => new Date().toLocaleDateString('en-CA');

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

    // Dengarkan perubahan data absensi secara real-time
    const q = query(collection(db, "absensi"), where("userId", "==", user.uid));
    onSnapshot(q, (querySnapshot) => {
        const userRecords = [];
        querySnapshot.forEach((doc) => {
            userRecords.push({ id: doc.id, ...doc.data() });
        });
        
        // Urutkan dari yang terbaru
        userRecords.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
        
        historyBody.innerHTML = '';
        if (userRecords.length > 0) {
            userRecords.forEach(rec => {
                const row = `<tr>
                    <td class="px-6 py-4">${rec.tanggal}</td>
                    <td class="px-6 py-4">${rec.jam_masuk}</td>
                    <td class="px-6 py-4">${rec.jam_pulang || 'Belum Clock Out'}</td>
                </tr>`;
                historyBody.innerHTML += row;
            });
        } else {
            historyBody.innerHTML = '<tr><td colspan="3" class="text-center p-4">Belum ada riwayat absensi.</td></tr>';
        }

        const todayEntry = userRecords.find(r => r.tanggal === getTodayDateString() && !r.jam_pulang);
        updateUI(todayEntry ? 'clocked-in' : 'clocked-out', todayEntry);
    });

    const performClocking = async (type) => {
        showLoading('Menyimpan data...');
        const now = new Date();
        const today = getTodayDateString();
        const currentTime = now.toTimeString().split(' ')[0];

        try {
            if (type === 'in') {
                await addDoc(collection(db, "absensi"), {
                    userId: user.uid,
                    username: userData.username,
                    tanggal: today,
                    jam_masuk: currentTime,
                    jam_pulang: null
                });
            } else {
                const q = query(collection(db, "absensi"), where("userId", "==", user.uid), where("tanggal", "==", today), where("jam_pulang", "==", null));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const docToUpdate = querySnapshot.docs[0];
                    await setDoc(doc(db, "absensi", docToUpdate.id), { jam_pulang: currentTime }, { merge: true });
                }
            }
            hideLoading();
            showAlert('Berhasil!', `Anda berhasil ${type === 'in' ? 'Clock In' : 'Clock Out'}.`, 'success');
        } catch (error) {
            hideLoading();
            showAlert('Error', error.message, 'error');
        }
    };

    clockInBtn.addEventListener('click', () => performClocking('in'));
    clockOutBtn.addEventListener('click', () => performClocking('out'));
}


// ===================================================================================
// HALAMAN DASBOR ADMIN
// ===================================================================================
if (window.location.pathname.includes('admin-dashboard.html')) {
    handleDashboardPage('admin');
}

function initAdminPage(user, userData) {
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
    Object.keys(tabs).forEach(key => tabs[key].btn.addEventListener('click', () => switchTab(key)));

    // --- Manajemen Pengguna ---
    const usersTableBody = document.getElementById('users-table-body');
    onSnapshot(collection(db, "users"), (snapshot) => {
        usersTableBody.innerHTML = '';
        snapshot.forEach(doc => {
            const u = doc.data();
            const row = `<tr>
                <td class="px-6 py-4">${u.username}</td>
                <td class="px-6 py-4">${u.email}</td>
                <td class="px-6 py-4">${u.role}</td>
                <td class="px-6 py-4"><button class="text-red-500" data-uid="${doc.id}">Hapus</button></td>
            </tr>`;
            usersTableBody.innerHTML += row;
        });
    });

    // --- Rekap Absensi ---
    const attendanceBody = document.getElementById('all-attendance-body');
    onSnapshot(collection(db, "absensi"), (snapshot) => {
        attendanceBody.innerHTML = '';
        snapshot.forEach(doc => {
            const rec = doc.data();
            const row = `<tr>
                <td class="px-6 py-4">${rec.username}</td>
                <td class="px-6 py-4">${rec.tanggal}</td>
                <td class="px-6 py-4">${rec.jam_masuk}</td>
                <td class="px-6 py-4">${rec.jam_pulang || '-'}</td>
            </tr>`;
            attendanceBody.innerHTML += row;
        });
    });
}
