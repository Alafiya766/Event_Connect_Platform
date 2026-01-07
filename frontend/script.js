const API = "http://localhost:5000";
let selectedEventId = null;

// --------------------- LOAD LOGGED USER ---------------------
const user = JSON.parse(localStorage.getItem("user"));
if (user) {
  const usernameEl = document.getElementById("username");
  const emailEl = document.getElementById("email");
  if (usernameEl) usernameEl.textContent = user.name;
  if (emailEl) emailEl.textContent = user.email;
}

// --------------------- DATE FORMAT ---------------------
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

// --------------------- EVENTS ---------------------
async function loadEvents() {
  const res = await fetch(`${API}/events`);
  const events = await res.json();

  const eventList = document.getElementById("eventList");
  if (!eventList) return;

  eventList.innerHTML = events.map(e => `
    <div class="card">
      <h3>${e.title}</h3>
      <p>${e.description}</p>
      <p><strong>Date:</strong> ${formatDate(e.event_date)}</p>
      <p><strong>Location:</strong> ${e.location}</p>
      <p><strong>Price:</strong> ₹${e.price}</p>
      <button onclick="registerEvent(${e.event_id}, ${e.price})">Register</button>
    </div>
  `).join("");
}
loadEvents();

// --------------------- UPCOMING EVENTS ---------------------
async function upcoming() {
  const res = await fetch(`${API}/events`);
  const events = await res.json();
  const myEvents = document.getElementById("myEvents");
  if (myEvents) {
    myEvents.innerHTML = events.map(e => `
      <div class="card">
        <h3>${e.title}</h3>
        <p>${e.description}</p>
        <p><b>${e.location}</b> — ${formatDate(e.event_date)}</p>
        <p>₹${e.price}</p>
      </div>
    `).join("");
  }
}
upcoming();

// --------------------- AUTH ---------------------
async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  if (!email || !password) return alert("Please fill all fields");

  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();

  if (!res.ok) return alert(data.message || "Invalid login");

  localStorage.setItem("user", JSON.stringify(data.user));
  alert("Login Successful!");

  if (data.user.role === "organizer") {
    window.location.href = "organizer-dashboard.html";
  } else {
    window.location.href = "user-dashboard.html";
  }
}

async function register() {
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;

  if (!name || !email || !password || !role) return alert("Please fill all fields");

  const res = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, role })
  });

  const data = await res.json();
  alert(data.message || "Registered");
  window.location.href = "login.html";
}

// Logout
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("user");
    window.location.href = "index.html";
  });
}

// --------------------- ORGANIZER EVENTS ---------------------
async function addCreateEvent() {
  const title = document.getElementById("title").value;
  const description = document.getElementById("description").value;
  const event_date = document.getElementById("event-date").value; // ISO format
  const location = document.getElementById("location").value;
  const price = document.getElementById("price").value;

  if (!title || !description || !event_date || !location || !price) return alert("Please fill all fields");
  if (!user) return alert("Please login first");

  const res = await fetch(`${API}/events/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      description,
      event_date,
      location,
      price,
      organizer_id: user.user_id
    })
  });

  const data = await res.json();
  alert(data.message);
  if (data.success) window.location.href = "organizer-dashboard.html";
}

//to delete event
async function deleteEvent(event_id) {
  if (!confirm("Are you sure you want to delete this event?")) return;

  const res = await fetch(`${API}/events/${event_id}`, { method: "DELETE" });
  const data = await res.json();
  alert(data.message);
  loadOrganizerEvents();
}
//stats for organizer dashboard
async function loadStats() {
  const res = await fetch(`${API}/stats/${organizer.user_id}`);
  const data = await res.json();

  document.getElementById("totalEvents").textContent = data.totalEvents;
  document.getElementById("totalRegistrations").textContent = data.totalRegistrations;
  document.getElementById("totalPayments").textContent = "₹" + data.totalPayments;
}
loadStats();

async function loadOrganizerEvents() {
  const res = await fetch(`${API}/events`);
  const events = await res.json();
  const myEvents = document.getElementById("myEvents");
  if (!myEvents) return;

  const filteredEvents = user && user.role === "organizer"
    ? events.filter(e => e.organizer_id === user.user_id)
    : events;

  myEvents.innerHTML = filteredEvents.map(e => `
    <div class="card">
      <h3>${e.title}</h3>
      <p>${e.description}</p>
      <p>${formatDate(e.event_date)}</p>
      <p>${e.location}</p>
      <p>₹${e.price}</p>
      ${user && user.role === "organizer" ? `<button onclick="deleteEvent(${e.event_id})">Delete</button>` : ""}
    </div>
  `).join("");
}

//In index page upcoming events
async function upcoming() {
  const res = await fetch(`${API}/events`);
  const events = await res.json();
  const myEvents = document.getElementById("myEvents");
  if (myEvents) {
    myEvents.innerHTML = events.map(e => `
      <div class="card">
        <h3>${e.title}</h3>
        <p>${e.description}</p>
        <p><b>${e.location}</b> — ${formatDate(e.event_date)}</p>
        <p>₹${e.price}</p>
      </div>
    `).join("");
  }
}
upcoming();


// --------------------- ORGANIZER DASHBOARD ---------------------
async function loadDashboard() {
  if (!user) return;

  // Load stats from backend
  const statsRes = await fetch(`${API}/events/stats/${user.user_id}`);
  const stats = await statsRes.json();

  const statsCards = document.getElementById("statsCards");
  if (statsCards) {
    statsCards.innerHTML = `
      <div class="dashboard-card">
        <h3>Total Events</h3>
        <p>${stats.totalEvents}</p>
      </div>
      <div class="dashboard-card">
        <h3>Total Registrations</h3>
        <p>${stats.totalRegistrations}</p>
      </div>
      <div class="dashboard-card">
        <h3>Total Payments</h3>
        <p>₹${stats.totalPayments}</p>
      </div>`;
  }

  loadOrganizerEvents();
}
//chart function
async function loadRegistrationChart() {
  if (!user || user.role !== "organizer") return;

  try {
    const res = await fetch(`${API}/events/registrations/${user.user_id}`);
    const eventsData = await res.json();

    const ctx = document.getElementById('regChart')?.getContext('2d');
    if (!ctx) return;

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: eventsData.map(e => e.title),
        datasets: [{
          label: 'Registrations',
          data: eventsData.map(e => e.registrations),
          backgroundColor: 'rgba(25,118,210,0.7)'
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });

  } catch (err) {
    console.error("Error loading registration chart:", err);
  }
}

if (document.getElementById("statsCards")) loadDashboard();loadRegistrationChart();

// Register for organizer created event - display function for user-dashboard
async function registerEvent(event_id, price) {
  if (!user) return alert("Please login first");
  try {
    const res = await fetch(`${API}/register`, {  
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.user_id,
        event_id
      })
    });

    const data = await res.json();
    if (!res.ok) return alert(data.error || "Registration failed");
    alert(data.message);
    window.location.href = `payment.html?event_id=${event_id}&price=${price}`;
  } catch (err) {
    console.error(err);
    alert("Something went wrong");
  }
}

// --------------------- PAYMENT ---------------------
const urlParams = new URLSearchParams(window.location.search);
const eventId = Number(urlParams.get("event_id"));
const price = Number(urlParams.get("price"));

const amountInputEl = document.getElementById("amount");
if (amountInputEl) amountInputEl.value = price;

function payNowFromPage() {
  const amountInput = Number(document.getElementById("amount").value);
  if (!eventId || isNaN(amountInput) || amountInput <= 0) return alert("Invalid event or amount");

  payNow(eventId, amountInput);
}

async function payNow(eventId, price) {
  if (!user) return alert("Please login first");

  const res = await fetch(`${API}/payment/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: user.user_id,
      event_id: eventId,
      amount: price
    })
  });

  const orderData = await res.json();
  if (!res.ok) return alert(orderData.error || "Error creating payment");

  const options = {
    key: "rzp_test_RoMIgWzByeDiR0", // Replace with your Razorpay key
    amount: price * 100,
    currency: "INR",
    name: "Event Management",
    description: "Event Payment",
    order_id: orderData.id, // Razorpay order_id
    handler: async function (response) {
        // Send to backend for verification
        const res = await fetch(`${API}/payment/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                email: user.email
            })
        });
        const data = await res.json();
        if (data.success) {
            alert("Payment successful!");
            window.location.href = "user-dashboard.html";
        } else {
            alert("Payment verification failed");
        }
    }
};

const rzp = new Razorpay(options);
rzp.open();
}

// 🌙 Dark / Light Mode Logic
async function loadTheme() {
  const toggle = document.getElementById("themeToggle");

  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
    toggle.checked = true;
  }

  toggle.addEventListener("change", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem(
      "theme",
      document.body.classList.contains("dark") ? "dark" : "light"
    );
  });
}
loadTheme();