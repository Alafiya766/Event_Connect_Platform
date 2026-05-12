/* =============================================
   EventConnect – script.js  (Fixed & Improved)
   Fixes:
    1. Payment workflow – registration confirmed ONLY after payment
    2. Event deletion – instant UI removal + backend cascade
    3. Revenue – only SUCCESS payments counted
    4. Charts – modern multi-chart dashboard (Chart.js)
    5. Map – Leaflet.js (free, reliable, no API key needed)
         Shows user location, event location, route
   ============================================= */

const API = "http://localhost:5000";
let allEvents = [];
let leafletMap = null;
let leafletMarkers = [];

/* ──────────────────────────────────────────────
   TOAST NOTIFICATIONS
   ────────────────────────────────────────────── */
function toast(msg, type = "info") {
  const icons = { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️" };
  const container = document.getElementById("toast-container");
  if (!container) { alert(msg); return; }

  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-msg">${msg}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateX(60px)";
    el.style.transition = "all .3s ease";
    setTimeout(() => el.remove(), 320);
  }, 3500);
}

/* ──────────────────────────────────────────────
   CURRENT USER
   ────────────────────────────────────────────── */
const user = (() => {
  try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
})();

function populateUser() {
  const fields = { username: user?.name, email: user?.email, navUsername: user?.name };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val) el.textContent = val;
  });
}
populateUser();

/* ──────────────────────────────────────────────
   DATE HELPERS
   ────────────────────────────────────────────── */
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric"
  });
}

function categoryIcon(cat = "") {
  const map = {
    Technology: "💻", Music: "🎵", Sports: "🏅", Education: "📚",
    Business: "💼", Arts: "🎨", Other: "🎪"
  };
  return map[cat] || "🎪";
}

/* ──────────────────────────────────────────────
   EVENT CARD BUILDER
   ────────────────────────────────────────────── */
function buildEventCard(e, opts = {}) {
  const { showRegister = false, showDelete = false, showViewMap = false } = opts;
  const cat = e.category || "Other";

  return `
  <div class="card" data-event-id="${e.event_id}">
    <div class="card-header">
      <h3>${e.title}</h3>
      <span class="card-badge">${categoryIcon(cat)} ${cat}</span>
    </div>
    <div class="card-body">
      <p class="card-desc">${e.description || "No description provided."}</p>
      <div class="card-meta">
        <div class="card-meta-row">
          <span class="meta-icon">📅</span>
          <span><strong>${formatDate(e.event_date)}</strong></span>
        </div>
        <div class="card-meta-row">
          <span class="meta-icon">📍</span>
          <span>${e.location}</span>
        </div>
        ${e.capacity ? `<div class="card-meta-row"><span class="meta-icon">👥</span><span>Capacity: <strong>${e.capacity}</strong></span></div>` : ""}
      </div>
      <div class="card-price">
        <div class="price-tag">${e.price > 0 ? `₹${Number(e.price).toLocaleString("en-IN")}` : '<span style="color:var(--success)">FREE</span>'} <span>/ ticket</span></div>
      </div>
    </div>
    <div class="card-actions">
      ${showRegister ? `<button class="btn btn-primary" onclick="registerEvent(${e.event_id}, ${e.price}, '${encodeURIComponent(e.title)}')"><i class="fa-solid fa-ticket"></i> Register</button>` : ""}
      ${showViewMap ? `<button class="btn btn-outline btn-sm" onclick="openLeafletEventModal(${JSON.stringify(e).replace(/"/g, '&quot;')})"><i class="fa-solid fa-map-location-dot"></i> Map</button>` : ""}
      ${showDelete ? `<button class="btn btn-danger btn-sm" onclick="deleteEvent(${e.event_id})"><i class="fa-solid fa-trash"></i> Delete</button>` : ""}
    </div>
  </div>`;
}

/* ──────────────────────────────────────────────
   LOAD EVENTS
   ────────────────────────────────────────────── */
async function loadEvents() {
  try {
    const res = await fetch(`${API}/events`);
    allEvents = await res.json();

    const myEventsEl = document.getElementById("myEvents");
    if (myEventsEl) renderEventGrid(myEventsEl, allEvents, { showRegister: false, showViewMap: true });

    const eventListEl = document.getElementById("eventList");
    if (eventListEl) renderEventGrid(eventListEl, allEvents, { showRegister: true, showViewMap: true });

    if (document.getElementById("mapContainer")) renderLeafletMap(allEvents);
  } catch (err) {
    console.error("loadEvents error:", err);
    toast("Failed to load events. Is the backend running?", "error");
  }
}

function renderEventGrid(container, events, opts) {
  if (!events.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>No events yet</p><small>Check back soon!</small></div>`;
    return;
  }
  container.innerHTML = events.map(e => buildEventCard(e, opts)).join("");
}

/* ──────────────────────────────────────────────
   SEARCH / FILTER
   ────────────────────────────────────────────── */
function filterEvents() {
  const q = (document.getElementById("searchInput")?.value || "").toLowerCase();
  const filtered = q
    ? allEvents.filter(e =>
      e.title?.toLowerCase().includes(q) ||
      e.location?.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q) ||
      (e.category || "").toLowerCase().includes(q)
    )
    : allEvents;

  const eventListEl = document.getElementById("eventList");
  const myEventsEl = document.getElementById("myEvents");
  if (eventListEl) renderEventGrid(eventListEl, filtered, { showRegister: true, showViewMap: true });
  if (myEventsEl) renderEventGrid(myEventsEl, filtered, { showRegister: false, showViewMap: true });
}

/* ──────────────────────────────────────────────
   ✅ FIX 5: LEAFLET MAP (free, no API key)
      - Shows user current location
      - Shows all event locations
      - Draws route between user & event
   ────────────────────────────────────────────── */
function ensureLeafletLoaded(callback) {
  if (window.L) { callback(); return; }

  // Load Leaflet CSS
  if (!document.getElementById("leaflet-css")) {
    const link = document.createElement("link");
    link.id = "leaflet-css";
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }

  // Load Leaflet JS + Routing Machine
  const script = document.createElement("script");
  script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
  script.onload = () => {
    // Load routing after leaflet
    const route = document.createElement("script");
    route.src = "https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.min.js";
    route.onload = () => callback();
    document.head.appendChild(route);

    if (!document.getElementById("leaflet-route-css")) {
      const rcss = document.createElement("link");
      rcss.id = "leaflet-route-css";
      rcss.rel = "stylesheet";
      rcss.href = "https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css";
      document.head.appendChild(rcss);
    }
  };
  document.head.appendChild(script);
}

function renderLeafletMap(events, targetContainerId = "mapContainer") {
  const container = document.getElementById(targetContainerId);
  if (!container) return;

  // Destroy previous map instance if any
  if (leafletMap && targetContainerId === "mapContainer") {
    leafletMap.remove();
    leafletMap = null;
    leafletMarkers = [];
  }

  ensureLeafletLoaded(() => {
    const L = window.L;
    const indiaCenter = [20.5937, 78.9629];

    const map = L.map(container, { zoomControl: true }).setView(indiaCenter, 5);
    if (targetContainerId === "mapContainer") leafletMap = map;

    // OpenStreetMap tiles (free, no key)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const bounds = [];
    let geocodeQueue = [...events];
    let idx = 0;

    function geocodeNext() {
      if (idx >= geocodeQueue.length) {
        if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40] });
        return;
      }
      const e = geocodeQueue[idx++];
      geocodeOSM(e.location, (lat, lng) => {
        if (!lat) { geocodeNext(); return; }

        const marker = L.marker([lat, lng], { icon: redIcon(L) }).addTo(map);
        marker.bindPopup(`
          <div style="font-family:Inter,sans-serif;min-width:180px">
            <strong style="color:#4f46e5">${e.title}</strong><br>
            <span style="font-size:.8rem;color:#666">📅 ${formatDate(e.event_date)}</span><br>
            <span style="font-size:.8rem;color:#666">📍 ${e.location}</span><br>
            <span style="font-weight:700;color:#10b981">${e.price > 0 ? `₹${Number(e.price).toLocaleString("en-IN")}` : "FREE"}</span>
          </div>
        `);
        if (targetContainerId === "mapContainer") leafletMarkers.push(marker);
        bounds.push([lat, lng]);
        if (bounds.length === 1) map.setView([lat, lng], 10);
        geocodeNext();
      });
    }
    geocodeNext();

    // Show user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const userIcon = L.divIcon({
          html: `<div style="width:18px;height:18px;background:#4f46e5;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(79,70,229,.6)"></div>`,
          iconSize: [18, 18], iconAnchor: [9, 9], className: ""
        });
        L.marker([lat, lng], { icon: userIcon })
          .addTo(map)
          .bindPopup("<strong>📍 Your Location</strong>")
          .openPopup();
      }, () => { });
    }
  });
}

function redIcon(L) {
  return L.divIcon({
    html: `<div style="width:22px;height:22px;background:#ef4444;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(239,68,68,.5)"></div>`,
    iconSize: [22, 22], iconAnchor: [11, 22], className: ""
  });
}

// Geocode using Nominatim (OpenStreetMap, free)
const _geocodeCache = {};
function geocodeOSM(location, callback) {
  if (_geocodeCache[location]) { callback(..._geocodeCache[location]); return; }
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location + ", India")}&format=json&limit=1`;
  fetch(url, { headers: { "Accept-Language": "en" } })
    .then(r => r.json())
    .then(data => {
      if (data.length) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        _geocodeCache[location] = [lat, lng];
        callback(lat, lng);
      } else {
        callback(null, null);
      }
    })
    .catch(() => callback(null, null));
}

/* ── Event Map Modal with user→event route ── */
function openLeafletEventModal(e) {
  if (typeof e === "string") { try { e = JSON.parse(e); } catch { return; } }

  const modal = document.getElementById("mapModal");
  if (!modal) return;

  document.getElementById("mapModalTitle") &&
    (document.getElementById("mapModalTitle").textContent = e.title);

  const body = document.getElementById("mapModalBody");
  if (body) {
    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:.45rem;font-size:.88rem;color:var(--text-secondary)">
        <div><i class="fa-solid fa-calendar" style="color:var(--primary);width:18px"></i> ${formatDate(e.event_date)}</div>
        <div><i class="fa-solid fa-location-dot" style="color:var(--danger);width:18px"></i> ${e.location}</div>
        <div><i class="fa-solid fa-indian-rupee-sign" style="color:var(--success);width:18px"></i> ${e.price > 0 ? `₹${e.price}` : "Free"}</div>
      </div>
      <div id="modalMapBox" style="height:260px;border-radius:10px;overflow:hidden;margin-top:1rem;border:1px solid var(--border)"></div>
      <a href="https://maps.google.com/?q=${encodeURIComponent(e.location + ", India")}" target="_blank"
         class="btn btn-outline btn-sm" style="margin-top:.75rem;display:inline-flex">
        <i class="fa-brands fa-google"></i> Open in Google Maps
      </a>`;
  }

  const regBtn = document.getElementById("mapRegisterBtn");
  if (regBtn) regBtn.onclick = () => { closeMapModal(); registerEvent(e.event_id, e.price, e.title); };

  modal.classList.add("open");

  // Render mini Leaflet map with route
  setTimeout(() => {
    ensureLeafletLoaded(() => {
      const L = window.L;
      const box = document.getElementById("modalMapBox");
      if (!box || box._leaflet_id) return;
      const miniMap = L.map(box).setView([20.5937, 78.9629], 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap", maxZoom: 19,
      }).addTo(miniMap);

      geocodeOSM(e.location, (lat, lng) => {
        if (!lat) return;
        L.marker([lat, lng], { icon: redIcon(L) }).addTo(miniMap)
          .bindPopup(`<strong>${e.title}</strong><br>${e.location}`).openPopup();
        miniMap.setView([lat, lng], 12);

        // If user location available, draw route
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(pos => {
            const uLat = pos.coords.latitude;
            const uLng = pos.coords.longitude;

            const userIcon = L.divIcon({
              html: `<div style="width:16px;height:16px;background:#4f46e5;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(79,70,229,.6)"></div>`,
              iconSize: [16, 16], iconAnchor: [8, 8], className: ""
            });
            L.marker([uLat, uLng], { icon: userIcon }).addTo(miniMap)
              .bindPopup("<strong>📍 You</strong>");

            // Route using OSRM (free routing, no key)
            if (window.L.Routing) {
              L.Routing.control({
                waypoints: [L.latLng(uLat, uLng), L.latLng(lat, lng)],
                routeWhileDragging: false,
                show: false,           // hide turn-by-turn panel inside modal
                lineOptions: {
                  styles: [{ color: "#4f46e5", weight: 4, opacity: 0.75 }]
                },
                createMarker: () => null, // use our custom markers
              }).addTo(miniMap);
            } else {
              // Fallback: draw a simple line
              L.polyline([[uLat, uLng], [lat, lng]], { color: "#4f46e5", weight: 3, dashArray: "6" }).addTo(miniMap);
              miniMap.fitBounds([[uLat, uLng], [lat, lng]], { padding: [30, 30] });
            }
          }, () => { });
        }
      });
    });
  }, 200);
}

function closeMapModal() {
  document.getElementById("mapModal")?.classList.remove("open");
}

/* ──────────────────────────────────────────────
   TAB BAR (user-dashboard)
   ────────────────────────────────────────────── */
function switchTab(tabId, btn) {
  ["events", "map", "registered"].forEach(id => {
    const el = document.getElementById(`tab-${id}`);
    if (el) el.style.display = "none";
  });
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));

  const target = document.getElementById(`tab-${tabId}`);
  if (target) target.style.display = "block";
  if (btn) btn.classList.add("active");

  if (tabId === "map") {
    // Re-render map on tab show (container might have been hidden)
    setTimeout(() => {
      if (!leafletMap) renderLeafletMap(allEvents);
      else leafletMap.invalidateSize();
    }, 100);
  }
  if (tabId === "registered") loadMyRegistrations();
}

async function loadMyRegistrations() {
  const container = document.getElementById("myRegistrations");
  if (!container || !user) return;

  try {
    const res = await fetch(`${API}/user/events/${user.user_id}`);
    const data = await res.json();

    if (!data.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon"></div><p>No confirmed registrations yet</p><small>Register for events and complete payment to see them here</small></div>`;
      return;
    }

    container.innerHTML = data.map(e => `
      <div class="card">
        <div class="card-header">
          <h3>${e.title}</h3>
          <span class="card-badge" style="background:#d1fae5;color:#065f46;border-color:#a7f3d0">✅ Confirmed</span>
        </div>
        <div class="card-body">
          <div class="card-meta">
            <div class="card-meta-row"><span class="meta-icon">📅</span><strong>${formatDate(e.event_date)}</strong></div>
            <div class="card-meta-row"><span class="meta-icon">📍</span>${e.location}</div>
            <div class="card-meta-row"><span class="meta-icon">💰</span>${e.price > 0 ? `₹${Number(e.price).toLocaleString("en-IN")}` : "Free"}</div>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn btn-outline btn-sm" onclick="openLeafletEventModal(${JSON.stringify(e).replace(/"/g, '&quot;')})">
            <i class="fa-solid fa-map-location-dot"></i> View on Map
          </button>
        </div>
      </div>`).join("");

  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Could not load registrations</p></div>`;
  }
}

/* ──────────────────────────────────────────────
   AUTH
   ────────────────────────────────────────────── */
async function login() {
  const email = document.getElementById("email")?.value?.trim();
  const password = document.getElementById("password")?.value;
  const btn = document.getElementById("loginBtn");

  if (!email || !password) { toast("Please fill in all fields", "warning"); return; }
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in…'; }

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) { toast(data.message || "Invalid credentials", "error"); return; }
    localStorage.setItem("user", JSON.stringify(data.user));
    toast("Login successful! Redirecting…", "success");
    setTimeout(() => {
      window.location.href = data.user.role === "organizer"
        ? "organizer-dashboard.html" : "user-dashboard.html";
    }, 900);
  } catch { toast("Connection error. Is the server running?", "error"); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In'; } }
}

async function register() {
  const name = document.getElementById("name")?.value?.trim();
  const email = document.getElementById("email")?.value?.trim();
  const password = document.getElementById("password")?.value;
  const role = document.getElementById("role")?.value;

  if (!name || !email || !password || !role) { toast("Please fill in all fields", "warning"); return; }
  if (password.length < 6) { toast("Password must be at least 6 characters", "warning"); return; }

  try {
    const res = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role })
    });
    const data = await res.json();
    if (!res.ok) { toast(data.message || "Registration failed", "error"); return; }
    toast("Account created! Please log in.", "success");
    setTimeout(() => window.location.href = "login.html", 1200);
  } catch { toast("Connection error. Is the server running?", "error"); }
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("user");
    toast("Logged out successfully", "info");
    setTimeout(() => window.location.href = "index.html", 700);
  });
}

/* ──────────────────────────────────────────────
   ✅ FIX 1: REGISTER FOR EVENT
   Registration created as PENDING first,
   then payment confirms it.
   ────────────────────────────────────────────── */
async function registerEvent(event_id, price, eventTitle = "") {
  if (!user) {
    toast("Please login to register for events", "warning");
    setTimeout(() => window.location.href = "login.html", 1000);
    return;
  }

  try {
    const res = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.user_id, event_id })
    });
    const data = await res.json();

    if (!res.ok) {
      toast(data.error || "Registration failed", "error");
      return;
    }

    // Already fully confirmed (paid or free)
    if (!data.requiresPayment) {
      toast("🎉 Registered successfully! (Free event)", "success");
      setTimeout(() => loadMyRegistrations(), 1000);
      return;
    }

    // Redirect to payment
    toast("Registration created! Redirecting to payment…", "info");
    const name = encodeURIComponent(eventTitle || "Event");
    setTimeout(() => {
      window.location.href = `payment.html?event_id=${event_id}&price=${price}&event_name=${name}`;
    }, 900);

  } catch { toast("Something went wrong. Please try again.", "error"); }
}

/* ──────────────────────────────────────────────
   ORGANIZER – CREATE EVENT
   ────────────────────────────────────────────── */
async function addCreateEvent() {
  const title = document.getElementById("title")?.value?.trim();
  const description = document.getElementById("description")?.value?.trim();
  const event_date = document.getElementById("event-date")?.value;
  const location = document.getElementById("location")?.value?.trim();
  const price = document.getElementById("price")?.value;
  const capacity = document.getElementById("capacity")?.value || null;

  if (!title || !description || !event_date || !location || price === "") {
    toast("Please fill in all required fields", "warning"); return;
  }
  if (!user) { toast("Please login first", "error"); return; }

  try {
    const res = await fetch(`${API}/events/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        event_date,
        location,
        price,
        capacity,
        organizer_id: user.user_id
      })
    });
    const data = await res.json();
    if (!res.ok || !data.success) { toast(data.message || "Failed to create event", "error"); return; }
    toast("Event created successfully!", "success");
    setTimeout(() => window.location.href = "organizer-dashboard.html", 1000);
  } catch { toast("Connection error", "error"); }
}

/* ──────────────────────────────────────────────
   ✅ FIX 2: DELETE EVENT (instant UI removal)
   ────────────────────────────────────────────── */
async function deleteEvent(event_id) {
  if (!confirm("Are you sure you want to delete this event?\nAll registrations and payments will also be removed. This cannot be undone.")) return;

  // Optimistically remove from UI immediately
  const card = document.querySelector(`.card[data-event-id="${event_id}"]`);
  if (card) {
    card.style.transition = "opacity .3s, transform .3s";
    card.style.opacity = "0";
    card.style.transform = "scale(.95)";
    setTimeout(() => card.remove(), 300);
  }

  try {
    const res = await fetch(`${API}/events/${event_id}`, { method: "DELETE" });
    const data = await res.json();

    if (!res.ok || !data.success) {
      toast(data.error || "Delete failed", "error");
      // Restore the card if server failed
      if (card) { card.style.opacity = "1"; card.style.transform = ""; }
      return;
    }

    // Remove from local cache
    allEvents = allEvents.filter(e => e.event_id !== event_id);
    toast("Event deleted successfully", "success");

    // Refresh stats
    loadDashboard();

  } catch {
    toast("Delete failed. Try again.", "error");
    if (card) { card.style.opacity = "1"; card.style.transform = ""; }
  }
}

/* ──────────────────────────────────────────────
   ✅ FIX 3 & 4: ORGANIZER DASHBOARD
   Revenue = only SUCCESS payments
   Modern multi-chart layout
   ────────────────────────────────────────────── */
let chartInstances = {};

async function loadDashboard() {
  if (!user) return;

  try {
    const statsRes = await fetch(`${API}/events/stats/${user.user_id}`);
    const stats = await statsRes.json();

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl("totalEvents", stats.totalEvents ?? 0);
    setEl("totalRegistrations", stats.totalRegistrations ?? 0);
    setEl("totalPayments", `₹${Number(stats.totalPayments || 0).toLocaleString("en-IN")}`);

    // Load charts with the enriched data
    loadCharts(stats.revenuePerEvent || []);

  } catch (err) {
    console.error("Stats load error:", err);
  }

  loadOrganizerEvents();
}

async function loadOrganizerEvents() {
  const container = document.getElementById("myEvents");
  if (!container || !user) return;

  try {
    const res = await fetch(`${API}/events`);
    const events = await res.json();

    const mine = user.role === "organizer"
      ? events.filter(e => e.organizer_id === user.user_id)
      : events;

    allEvents = mine;

    if (!mine.length) {
      container.innerHTML = `<div class="empty-state"><p>No events yet</p><small><a href="create-event.html">Create your first event</a></small></div>`;
      return;
    }
    container.innerHTML = mine.map(e => buildEventCard(e, { showDelete: true, showViewMap: true })).join("");

    if (document.getElementById("mapContainer")) renderLeafletMap(mine);

  } catch { toast("Failed to load your events", "error"); }
}

/* ── Modern Charts ── */
function loadCharts(revenueData) {
  if (!window.Chart) return;

  const labels = revenueData.map(e => e.title.length > 15 ? e.title.slice(0, 13) + "…" : e.title);
  const revenues = revenueData.map(e => Number(e.revenue));
  const regCounts = revenueData.map(e => Number(e.paid_count));

  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1e1b4b",
        titleColor: "#c7d2fe",
        bodyColor: "#e0e7ff",
        padding: 12,
        cornerRadius: 8,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: "rgba(79,70,229,.08)" },
        ticks: { color: "#6b7280", font: { size: 11 } }
      },
      x: {
        grid: { display: false },
        ticks: { color: "#6b7280", font: { size: 11 } }
      }
    }
  };

  // Revenue chart
  const revenueCtx = document.getElementById("revenueChart")?.getContext("2d");
  if (revenueCtx) {
    if (chartInstances.revenue) chartInstances.revenue.destroy();
    chartInstances.revenue = new Chart(revenueCtx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Revenue (₹)",
          data: revenues,
          backgroundColor: revenues.map(() => "rgba(79,70,229,0.75)"),
          borderColor: revenues.map(() => "rgba(79,70,229,1)"),
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
        }]
      },
      options: {
        ...chartDefaults,
        plugins: {
          ...chartDefaults.plugins,
          legend: { display: true, labels: { color: "#374151", font: { size: 12 } } },
          tooltip: {
            ...chartDefaults.plugins.tooltip,
            callbacks: { label: ctx => `  ₹${ctx.raw.toLocaleString("en-IN")}` }
          }
        }
      }
    });
  }

  // Registrations chart
  const regCtx = document.getElementById("regChart")?.getContext("2d");
  if (regCtx) {
    if (chartInstances.reg) chartInstances.reg.destroy();
    chartInstances.reg = new Chart(regCtx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Confirmed Registrations",
          data: regCounts,
          backgroundColor: "rgba(16,185,129,0.7)",
          borderColor: "rgba(16,185,129,1)",
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
        }]
      },
      options: {
        ...chartDefaults,
        plugins: {
          ...chartDefaults.plugins,
          legend: { display: true, labels: { color: "#374151", font: { size: 12 } } },
        },
        scales: {
          ...chartDefaults.scales,
          y: { ...chartDefaults.scales.y, ticks: { ...chartDefaults.scales.y.ticks, stepSize: 1 } }
        }
      }
    });
  }

  // Event performance donut chart
  const perfCtx = document.getElementById("perfChart")?.getContext("2d");
  if (perfCtx && revenueData.length) {
    if (chartInstances.perf) chartInstances.perf.destroy();
    const colors = [
      "#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16", "#f97316"
    ];
    chartInstances.perf = new Chart(perfCtx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data: revenues.length && revenues.some(v => v > 0) ? revenues : regCounts,
          backgroundColor: colors.slice(0, labels.length),
          borderColor: "#ffffff",
          borderWidth: 3,
          hoverOffset: 8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "65%",
        plugins: {
          legend: {
            position: "right",
            labels: { color: "#374151", font: { size: 11 }, padding: 14 }
          },
          tooltip: {
            backgroundColor: "#1e1b4b",
            titleColor: "#c7d2fe",
            bodyColor: "#e0e7ff",
            padding: 12,
            cornerRadius: 8,
            callbacks: { label: ctx => `  ${ctx.label}: ₹${ctx.raw.toLocaleString("en-IN")}` }
          }
        }
      }
    });
  }
}

/* ──────────────────────────────────────────────
   ✅ FIX 1 (continued): PAYMENT – RAZORPAY
   Registration is confirmed ONLY after verification
   ────────────────────────────────────────────── */
const urlParams = new URLSearchParams(window.location.search);
const eventId = Number(urlParams.get("event_id"));
const price = Number(urlParams.get("price"));
const _currentOrderId = { value: null };  // track order for failure reporting

const amountInputEl = document.getElementById("amount");
if (amountInputEl) amountInputEl.value = price;

function payNowFromPage() {
  const amountVal = Number(document.getElementById("amount")?.value || price);
  if (!eventId || isNaN(amountVal) || amountVal < 0) {
    toast("Invalid event or amount", "error"); return;
  }
  payNow(eventId, amountVal);
}

async function payNow(evtId, amt) {
  if (!user) { toast("Please login first", "error"); return; }

  const payBtn = document.getElementById("payBtn");
  if (payBtn) { payBtn.disabled = true; payBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Initiating…'; }

  try {
    const res = await fetch(`${API}/payment/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.user_id, event_id: evtId, amount: amt })
    });
    const orderData = await res.json();
    if (!res.ok) { toast(orderData.error || "Error creating payment", "error"); return; }

    _currentOrderId.value = orderData.id;

    const options = {
      key: "rzp_test_RoMIgWzByeDiR0",
      amount: amt * 100,
      currency: "INR",
      name: "EventConnect",
      description: "Event Ticket Payment",
      order_id: orderData.id,

      prefill: {
        name: user.name || "",
        email: user.email || "",
        contact: user.phone || "",
      },

      theme: { color: "#4f46e5" },

      // Enable UPI app intent so GPay/PhonePe buttons actually launch apps
      config: {
        display: {
          blocks: {
            utib: { name: "Pay via UPI Apps", instruments: [{ method: "upi", flows: ["intent", "qr"] }] },
          },
          sequence: ["block.utib"],
          preferences: { show_default_blocks: true },
        },
      },

      // Note: in Razorpay TEST mode, UPI app intents (GPay/PhonePe) are
      // simulated — clicking them opens a Razorpay test success screen.
      // In LIVE mode with a real key, clicking will deep-link into the UPI app.

      handler: async function (response) {
        toast("Verifying payment…", "info");
        try {
          const verifyRes = await fetch(`${API}/payment/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              user_id: user.user_id,
              event_id: evtId,
              email: user.email,
            })
          });
          const vData = await verifyRes.json();

          if (vData.success) {
            toast("🎉 Payment successful! Registration confirmed.", "success");
            setTimeout(() => window.location.href = "user-dashboard.html", 1500);
          } else {
            toast(`Payment verification failed: ${vData.message || "Contact support"}`, "error");
          }
        } catch {
          toast("Error verifying payment. Contact support.", "error");
        }
      },

      modal: {
        ondismiss: () => {
          toast("Payment cancelled. Your registration is on hold.", "warning");
          // Report cancellation to backend
          fetch(`${API}/payment/failed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: _currentOrderId.value,
              user_id: user.user_id,
              event_id: evtId,
            })
          }).catch(() => { });
        },
        escape: true,
      },
    };

    const rzp = new Razorpay(options);
    rzp.on("payment.failed", (response) => {
      toast(`Payment failed: ${response.error.description}`, "error");
      // Report failure to backend
      fetch(`${API}/payment/failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: _currentOrderId.value,
          user_id: user.user_id,
          event_id: evtId,
        })
      }).catch(() => { });
    });
    rzp.open();

  } catch (err) {
    toast("Something went wrong while initiating payment.", "error");
    console.error("Payment init error:", err);
  } finally {
    if (payBtn) {
      payBtn.disabled = false;
      payBtn.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Pay Securely ₹${amt}`;
    }
  }
}

/* ──────────────────────────────────────────────
   DARK / LIGHT MODE
   ────────────────────────────────────────────── */
function loadTheme() {
  const toggle = document.getElementById("themeToggle");
  if (!toggle) return;

  const fabIcon = document.querySelector(".theme-fab-icon");

  function applyTheme(isDark) {
    document.body.classList.toggle("dark", isDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    toggle.checked = isDark;
    if (fabIcon) fabIcon.textContent = isDark ? "☀️" : "🌙";
  }

  // Apply saved preference
  applyTheme(localStorage.getItem("theme") === "dark");

  toggle.addEventListener("change", () => {
    const isDark = toggle.checked;
    applyTheme(isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  });
}
loadTheme();


/* ──────────────────────────────────────────────
   AUTO-INIT
   ────────────────────────────────────────────── */
(function init() {
  const page = window.location.pathname.split("/").pop() || "index.html";

  const protected_ = ["user-dashboard.html", "organizer-dashboard.html", "create-event.html", "payment.html"];
  if (protected_.includes(page) && !user) {
    toast("Please login first", "warning");
    setTimeout(() => window.location.href = "login.html", 800);
    return;
  }

  if (page === "organizer-dashboard.html" && user?.role !== "organizer") {
    window.location.href = "user-dashboard.html"; return;
  }
  if (page === "create-event.html" && user?.role !== "organizer") {
    window.location.href = "user-dashboard.html"; return;
  }

  if (page === "index.html" || page === "") loadEvents();
  if (page === "user-dashboard.html") loadEvents();
  if (page === "organizer-dashboard.html") loadDashboard();
})();
