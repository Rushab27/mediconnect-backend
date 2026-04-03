const express = require('express');
const router = express.Router();
const { clinicSignup, clinicLogin, getClinicProfile, updateClinicProfile } = require('../controllers/clinicAuthController');
const { patientSignup, patientLogin, getPatientProfile } = require('../controllers/patientAuthController');
const { addDoctor, getDoctors, getDoctor, updateDoctor, deleteDoctor, getPublicDoctors } = require('../controllers/doctorsController');
const { bookAppointment, getClinicAppointments, getPatientAppointments, updateAppointmentStatus, cancelAppointment, getTodaysAppointments } = require('../controllers/appointmentsController');
const { getDashboardStats, getMonthlyAnalytics } = require('../controllers/analyticsController');
const { verifyWebhook, receiveMessage, registerWhatsappNumber, getWhatsappStatus } = require('../controllers/whatsappController');
const { verifyClinic, verifyPatient, verifyToken } = require('../middleware/auth');
const { clinicSignupRules, patientSignupRules, loginRules, doctorRules, appointmentRules, validate } = require('../middleware/validation');

// ═══════════════════════════════════════════════════
// CLINIC AUTH ROUTES
// ═══════════════════════════════════════════════════
router.post('/clinic/signup', clinicSignupRules, validate, clinicSignup);
router.post('/clinic/login', loginRules, validate, clinicLogin);
router.get('/clinic/profile', verifyClinic, getClinicProfile);
router.put('/clinic/profile', verifyClinic, updateClinicProfile);

// ═══════════════════════════════════════════════════
// PATIENT AUTH ROUTES
// ═══════════════════════════════════════════════════
router.post('/patient/signup', patientSignupRules, validate, patientSignup);
router.post('/patient/login', loginRules, validate, patientLogin);
router.get('/patient/profile', verifyPatient, getPatientProfile);

// ═══════════════════════════════════════════════════
// DOCTOR ROUTES (clinic manages their doctors)
// ═══════════════════════════════════════════════════
router.post('/doctors', verifyClinic, doctorRules, validate, addDoctor);
router.get('/doctors', verifyClinic, getDoctors);
router.get('/doctors/:id', verifyClinic, getDoctor);
router.put('/doctors/:id', verifyClinic, updateDoctor);
router.delete('/doctors/:id', verifyClinic, deleteDoctor);

// Public route - patients can see doctors at a clinic (no login required)
router.get('/public/clinics/:clinic_id/doctors', getPublicDoctors);

// ═══════════════════════════════════════════════════
// APPOINTMENT ROUTES
// ═══════════════════════════════════════════════════
// Patient books appointment
router.post('/appointments', verifyPatient, appointmentRules, validate, bookAppointment);
// Patient cancels their own appointment
router.put('/appointments/:id/cancel', verifyPatient, cancelAppointment);
// Patient views their appointments
router.get('/patient/appointments', verifyPatient, getPatientAppointments);

// Clinic views all their appointments
router.get('/clinic/appointments', verifyClinic, getClinicAppointments);
// Clinic views today's appointments
router.get('/clinic/appointments/today', verifyClinic, getTodaysAppointments);
// Clinic updates appointment status
router.put('/clinic/appointments/:id/status', verifyClinic, updateAppointmentStatus);

// ═══════════════════════════════════════════════════
// ANALYTICS ROUTES (clinic only)
// ═══════════════════════════════════════════════════
router.get('/clinic/dashboard', verifyClinic, getDashboardStats);
router.get('/clinic/analytics/monthly', verifyClinic, getMonthlyAnalytics);

// ═══════════════════════════════════════════════════
// WHATSAPP BOT ROUTES
// ═══════════════════════════════════════════════════
// Meta calls these to verify + send messages (NO auth — public)
router.get('/whatsapp/webhook', verifyWebhook);
router.post('/whatsapp/webhook', receiveMessage);

// Clinic connects their WhatsApp number (needs clinic login)
router.post('/whatsapp/register', verifyClinic, registerWhatsappNumber);
router.get('/whatsapp/status', verifyClinic, getWhatsappStatus);

module.exports = router;
