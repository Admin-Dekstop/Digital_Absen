// scripts.js - Semua logika Firebase Absensi

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-analytics.js";

// === CONFIG Firebase PUNYAMU ===
const firebaseConfig = {
  apiKey: "AIzaSyC0z1cBGaNGvzmt7pGg2MxmX_jycquOAAs",
  authDomain: "absensi-7cf56.firebaseapp.com",
  projectId: "absensi-7cf56",
  storageBucket: "absensi-7cf56.firebasestorage.app",
  messagingSenderId: "551257747862",
  appId: "1:551257747862:web:437137b5f78ee558fdedb7",
  measurementId: "G-EQH93YEMEW"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const analytics = getAnalytics(app);

// Global biar bisa dipanggil di HTML
window.db = db;
window.auth = auth;

// === REGISTER ===
document.getElementById("register-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("register-username").value;
  const email = document.getElementById("register-email").value;
  const password = document.getElementById("register-password").value;

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    await addDoc(collection(db, "users"), {
      uid: userCred.user.uid,
      name,
      email,
      role: "karyawan"
    });
    alert("Akun berhasil dibuat!");
    location.href = "karyawan-dashboard.html";
  } catch (err) {
    alert("Gagal registrasi: " + err.message);
  }
});

// === LOGIN ===
document.getElementById("login-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    const q = query(collection(db, "users"), where("uid", "==", userCred.user.uid));
    const snapshot = await getDocs(q);
    const userData = snapshot.docs[0].data();

    if (userData.role === "admin") {
      location.href = "admin-dashboard.html";
    } else {
      location.href = "karyawan-dashboard.html";
    }
  } catch (err) {
    alert("Gagal login: " + err.message);
  }
});

// === CLOCK IN ===
document.getElementById("clock-in-btn")?.addEventListener("click", async () => {
  const user = auth.currentUser;
  const now = new Date();
  const tanggal = now.toLocaleDateString();
  const jam = now.toLocaleTimeString();

  try {
    await addDoc(collection(db, "absensi"), {
      uid: user.uid,
      tanggal,
      jamMasuk: jam,
      jamPulang: ""
    });
    alert("Berhasil Clock In!");
  } catch (err) {
    alert("Gagal Clock In: " + err.message);
  }
});

// === CLOCK OUT ===
document.getElementById("clock-out-btn")?.addEventListener("click", async () => {
  const user = auth.currentUser;
  const now = new Date();
  const tanggal = now.toLocaleDateString();
  const jam = now.toLocaleTimeString();

  const q = query(collection(db, "absensi"),
    where("uid", "==", user.uid),
    where("tanggal", "==", tanggal)
  );

  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    const docRef = doc(db, "absensi", snapshot.docs[0].id);
    await updateDoc(docRef, { jamPulang: jam });
    alert("Berhasil Clock Out!");
  } else {
    alert("Belum Clock In hari ini.");
  }
});

// === LOGOUT ===
document.getElementById("logout-btn")?.addEventListener("click", async () => {
  await signOut(auth);
  location.href = "index.html";
});
