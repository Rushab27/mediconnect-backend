# 🏥 MediConnect Backend — Step 2 Complete

## ✅ What's Built
- Clinic signup/login (with JWT tokens)
- Patient signup/login
- Doctor management (add, edit, delete)
- Appointment booking, cancelling, rescheduling
- Today's appointments view
- Dashboard analytics (stats, charts data)
- Full security (rate limiting, input validation, helmet, data isolation)

---

## 🚀 How to Run on YOUR Computer

### Step 1 — Make sure Node.js is installed
Go to https://nodejs.org → Download LTS → Install it

### Step 2 — Extract this ZIP
Extract the folder anywhere on your computer.

### Step 3 — Open terminal in the folder
- Windows: Right click inside folder → "Open in Terminal"
- Mac: Right click → "New Terminal at Folder"

### Step 4 — Install packages
```
npm install
```

### Step 5 — Start the server
```
node server.js
```

### ✅ You should see:
```
🚀 MediConnect Backend running on port 5000
✅ Database connected successfully!
```

---

## 📡 All API Routes

### Clinic Routes
| Method | Route | What it does |
|--------|-------|--------------|
| POST | /api/clinic/signup | Register new clinic |
| POST | /api/clinic/login | Clinic login |
| GET | /api/clinic/profile | Get clinic info |
| PUT | /api/clinic/profile | Update clinic info |
| GET | /api/clinic/dashboard | Dashboard stats |
| GET | /api/clinic/appointments | All appointments |
| GET | /api/clinic/appointments/today | Today's appointments |

### Patient Routes
| Method | Route | What it does |
|--------|-------|--------------|
| POST | /api/patient/signup | Register new patient |
| POST | /api/patient/login | Patient login |
| GET | /api/patient/profile | Patient profile |
| GET | /api/patient/appointments | Patient's appointments |

### Doctor Routes
| Method | Route | What it does |
|--------|-------|--------------|
| POST | /api/doctors | Add a doctor |
| GET | /api/doctors | List all doctors |
| PUT | /api/doctors/:id | Update doctor |
| DELETE | /api/doctors/:id | Remove doctor |

### Appointment Routes
| Method | Route | What it does |
|--------|-------|--------------|
| POST | /api/appointments | Book appointment |
| PUT | /api/appointments/:id/cancel | Cancel appointment |
| PUT | /api/clinic/appointments/:id/status | Update status |

---

## 🔐 Security Features Included
- ✅ JWT authentication (7-day tokens)
- ✅ Bcrypt password hashing (12 rounds)
- ✅ Rate limiting (100 req/15min general, 10 req/15min for login)
- ✅ Input validation on all routes
- ✅ Clinic data isolation (Clinic A cannot see Clinic B data)
- ✅ Helmet security headers
- ✅ SQL injection protection (parameterized queries)

---

## ⏭️ Next Step
Once you've confirmed the server runs locally → we deploy to Railway!
Then → Step 3 → Frontend Web App
