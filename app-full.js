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
const appAuth = {
  async register({ name, email, password, role }) {
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      await db.collection('users').doc(user.uid).set({
        name, email, role,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },
  async login(email, password) {
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      const doc = await db.collection('users').doc(user.uid).get();
      const role = doc.exists ? doc.data().role : 'buyer';
      return { success: true, role };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },
  logout() { return auth.signOut(); }
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

/* ================= Cart Functions ================= */
const cartAPI = {
  getCart() { return JSON.parse(localStorage.getItem('cart') || '[]'); },
  addItem(item) {
    let arr = this.getCart();
    const idx = arr.findIndex(i => i.id === item.id);
    if (idx > -1) arr[idx].quantity += item.quantity || 1;
    else arr.push({ ...item, quantity: item.quantity || 1 });
    localStorage.setItem('cart', JSON.stringify(arr));
  },
  removeItem(idx) {
    let arr = this.getCart(); arr.splice(idx, 1); localStorage.setItem('cart', JSON.stringify(arr));
  },
  clearCart() { localStorage.removeItem('cart'); },
  getTotal() { return this.getCart().reduce((sum, i) => sum + i.price * i.quantity, 0); }
};

/* ================= Weather Helper ================= */
const OPENWEATHER_API_KEY = "OPENWEATHER_API_KEY"; // Replace with your key
async function getLocalWeatherText() {
  try {
    if (!navigator.geolocation) return 'Geolocation not supported by your browser.';
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 }));
    const lat = pos.coords.latitude, lon = pos.coords.longitude;
    if (!OPENWEATHER_API_KEY || OPENWEATHER_API_KEY === 'OPENWEATHER_API_KEY') return 'OpenWeather key not configured.';
    const resp = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`);
    if (!resp.ok) return 'Weather fetch failed.';
    const data = await resp.json();
    let advice = '';
    if (data.main.temp > 30) advice += 'Hot weather — protect seedlings from sun. ';
    if ((data.weather[0].main || '').toLowerCase().includes('rain')) advice += 'Rain expected — protect harvest and avoid field work. ';
    if (data.wind && data.wind.speed > 8) advice += 'Windy — stake tall crops. ';
    if (!advice) advice = 'No immediate weather actions needed.';
    return `Weather: ${data.name} — ${data.weather[0].description}, ${data.main.temp}°C. Advice: ${advice}`;
  } catch (e) { console.error(e); return 'Unable to get local weather. Allow location or try again.'; }
}

/* ================= Buyer / Farmer Chatbot ================= */
const OPENAI_CHAT_ENDPOINT = "OPENAI_CHAT_ENDPOINT"; // replace with your endpoint
(function createChatUI(rootId = 'chatbot-root') {
  let root = document.getElementById(rootId);
  if (!root) root = document.body.appendChild(document.createElement('div'));
  root.innerHTML = `
    <div class="chat-bubble fixed right-5 bottom-5 z-50">
      <div id="chatHeader" class="bg-gradient-to-br from-green-700 to-yellow-500 text-white p-3 rounded-t-xl shadow cursor-pointer">FamFresh Helper</div>
      <div class="chat-window hidden bg-white rounded-b-xl shadow p-3 w-80 max-w-xs">
        <div id="chatMessages" class="h-56 overflow-auto text-sm space-y-2"></div>
        <div class="mt-3 flex gap-2">
          <input id="chatInput" placeholder="Ask about weather, pests, storage, booking..." class="flex-1 border rounded px-3 py-2"/>
          <button id="sendBtn" class="bg-green-700 text-white px-3 py-2 rounded">Ask</button>
        </div>
        <div class="mt-2 text-xs text-gray-500">Tip: ask "book storage" or "weather" for quick actions.</div>
      </div>
    </div>
  `;
  const header = root.querySelector('#chatHeader');
  const windowEl = root.querySelector('.chat-window');
  const sendBtn = root.querySelector('#sendBtn');
  const chatInput = root.querySelector('#chatInput');
  const messagesEl = root.querySelector('#chatMessages');
  header.addEventListener('click', () => windowEl.classList.toggle('hidden'));
  function addMessage(role, text) {
    messagesEl.innerHTML += `<div class="${role === 'bot' ? 'text-sm text-gray-800' : 'text-sm text-green-700'}"><strong>${role === 'bot' ? 'FamFresh' : 'You'}:</strong> ${text}</div>`;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  async function getAIReply(prompt) {
    if (!OPENAI_CHAT_ENDPOINT || OPENAI_CHAT_ENDPOINT === 'OPENAI_CHAT_ENDPOINT') return 'AI endpoint not configured.';
    try {
      const r = await fetch(OPENAI_CHAT_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      const data = await r.json();
      if (r.ok && data.reply) return data.reply;
      return data.error || 'No reply from AI.';
    } catch (err) { console.error(err); return 'AI service error — try again later.'; }
  }
  sendBtn.addEventListener('click', async () => {
    const prompt = chatInput.value.trim(); if (!prompt) return;
    addMessage('user', prompt); chatInput.value = '';
    addMessage('bot', 'Thinking...');
    const reply = await getAIReply(prompt);
    messagesEl.removeChild(messagesEl.lastElementChild);
    addMessage('bot', reply);
  });
  window.appChat = window.appChat || {};
  window.appChat.addMessage = (r, t) => addMessage(r, t);
  window.appChat.getReply = async (q) => {
    addMessage('user', q); addMessage('bot', 'Thinking...');
    const rep = await getAIReply(q);
    messagesEl.removeChild(messagesEl.lastElementChild);
    addMessage('bot', rep); return rep;
  };
  window.appChat.fetchLocalWeatherAndTips = async () => { if (typeof getLocalWeatherText === 'function') return await getLocalWeatherText(); return 'Weather helper not configured.'; };
})();
