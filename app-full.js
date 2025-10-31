<!-- app-full.js -->
<script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-auth.js"></script>
<script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-firestore.js"></script>
<script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-storage.js"></script>

<script>
/* ================= Firebase Init ================= */
const firebaseConfig = {
  apiKey: "AIzaSyCswU-LrTo6nOe_JkmepizOHwWyZxbteCc",
  authDomain: "famfresh-ea11f.firebaseapp.com",
  projectId: "famfresh-ea11f",
  storageBucket: "famfresh-ea11f.appspot.com",
  messagingSenderId: "713550151605",
  appId: "1:713550151605:web:48641c0ed46771542223fc",
  measurementId: "G-TW5GD58FYC"
};
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

/* =================== Auth =================== */
window.appAuth = {
  register: async ({ name, email, password, role }) => {
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      await db.collection('users').doc(user.uid).set({
        name, email, role,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error("Register Error:", error);
      return { success: false, message: error.message };
    }
  },
  login: async (email, password) => {
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      const doc = await db.collection('users').doc(user.uid).get();
      const role = doc.exists ? doc.data().role : 'buyer';
      return { success: true, role };
    } catch (error) {
      console.error("Login Error:", error);
      return { success: false, message: error.message };
    }
  },
  logout: async () => { return auth.signOut(); }
};

/* ============ Auth Redirect ============ */
auth.onAuthStateChanged(async (user) => {
  const page = window.location.pathname.split("/").pop();
  if (page.includes('dashboard') && !user) window.location.href = 'login.html';
  if ((page === 'login.html' || page === 'register.html') && user) {
    const doc = await db.collection('users').doc(user.uid).get();
    const role = doc.exists ? doc.data().role : 'buyer';
    if (role === 'farmer') window.location.href = 'farmer-dashboard.html';
    else if (role === 'admin') window.location.href = 'admin-dashboard.html';
    else window.location.href = 'buyer-dashboard.html';
  }
});

/* =================== Cart, Products, Weather, Chatbot, Admin Chatbot =================== */
/* Keep all previous appData, cartAPI, weather.js, chatbot.js, chatbot-admin.js code here exactly */
</script>
