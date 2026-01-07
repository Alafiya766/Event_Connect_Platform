# EventConnect Platform
Event Connect is a full-stack event management and booking platform that allows users to discover events, register, and make payments,e-mail notifications while organizers can create and manage events efficiently.

- **Role-based Authentication** (User / Organizer)
- **EventConnect Platform** (Create, Delete, List, Register, Make Payment)
- **Payments** using Razorpay
- **Email Notifications** after payment
- **Responsive Material UI-inspired Frontend**
- **Organizer Dashboard** with stats & charts


🚀 Features
👤 User

-User registration & login
-Browse available events
-Event registration
-Secure online payment (Razorpay)
-View registered events

🧑‍💼 Organizer

-Organizer login
-Create new events
-View created events
-Delete events
-Track event registrations
-Dashboard with event statistics


## Tech Stack

- **Frontend:** HTML, CSS, JS
- **Backend:** Node.js, Express.js  
- **Database:** MySQL  
- **Payments:** Razorpay  
- **Email:** Nodemailer  


⚙️ Installation & Setup

1️⃣ Clone the Repository
git clone https://github.com/Alafiya766/Event_Connect_Platform.git
cd EventConnect-Platform

2️⃣ Backend Setup (Node.js + Express)
cd backend
npm install express mysql2 dotenv cors bcrypt jsonwebtoken nodemailer razorpay body-parser

**Create environment file:
.env

DB_HOST=localhost
DB_USER=
DB_PASSWORD=
DB_NAME=

JWT_SECRET=

RAZORPAY_KEY=YOUR_RAZORPAY_KEY
RAZORPAY_SECRET=YOUR_RAZORPAY_SECRET

EMAIL_USER = CentralizedEmailAccount@gmail.com
EMAIL_PASS = AppPassword

**Start Server:
npm start

3️⃣ Frontend Setup
---VS Code Live Server (Recommended)

1. Install Live Server extension
2. Right-click index.html
3. Click Open with Live Server

Frontend runs at:
http://127.0.0.1:5500

4️⃣ Database Setup (MySQL)

-Open MySQL Workbench or MySQL CLI
-Create the database and tables:
-SOURCE database/event_system.sql;

✔ This will create:
users
events
registrations
payments tables

5️⃣ Razorpay Integration
--Supports Test Mode and Live Mode
--Payments stored in payments table
--Order creation handled in backend

5️⃣Test the Application

*USER FLOW
--Register as User
--Login
--Browse events
--Register for events
--Make payment
--Receive email confirmation

*ORGANIZER FLOW 
--Register as Organizer
--Login
--Create events
--View dashboard analytics
--Track registrations & payments