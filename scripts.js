<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyD0fn9GpXecR3MCDRxatZO8yy4fVxJwF5w",
    authDomain: "sistem-absensi-kantor-ebd3b.firebaseapp.com",
    projectId: "sistem-absensi-kantor-ebd3b",
    storageBucket: "sistem-absensi-kantor-ebd3b.firebasestorage.app",
    messagingSenderId: "150894457640",
    appId: "1:150894457640:web:c07c5d5f6b83a4e72b561d",
    measurementId: "G-CW25HP7NDS"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>
