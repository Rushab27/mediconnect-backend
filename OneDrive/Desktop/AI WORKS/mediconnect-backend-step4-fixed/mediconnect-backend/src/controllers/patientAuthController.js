const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// ─── PATIENT SIGNUP ───────────────────────────────────────────────
const patientSignup = async (req, res) => {
  const { full_name, email, password, phone, date_of_birth, gender, blood_group } = req.body;

  try {
    // Check if email already exists
    const existing = await pool.query(
      'SELECT id FROM patients WHERE email = $1', [email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'Email already registered. Please login.' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Insert patient
    const result = await pool.query(
      `INSERT INTO patients (full_name, email, password, phone, date_of_birth, gender, blood_group)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, full_name, email, phone`,
      [full_name, email, hashedPassword, phone, date_of_birth || null, gender || null, blood_group || null]
    );

    const patient = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { id: patient.id, role: 'patient' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Patient registered successfully!',
      token,
      patient: {
        id: patient.id,
        full_name: patient.full_name,
        email: patient.email,
        phone: patient.phone
      }
    });

  } catch (err) {
    console.error('Patient signup error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// ─── PATIENT LOGIN ────────────────────────────────────────────────
const patientLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM patients WHERE email = $1', [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const patient = result.rows[0];

    const isMatch = await bcrypt.compare(password, patient.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: patient.id, role: 'patient' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      patient: {
        id: patient.id,
        full_name: patient.full_name,
        email: patient.email,
        phone: patient.phone,
        gender: patient.gender,
        blood_group: patient.blood_group
      }
    });

  } catch (err) {
    console.error('Patient login error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// ─── GET PATIENT PROFILE ──────────────────────────────────────────
const getPatientProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, phone, date_of_birth, gender, blood_group, 
              address, medical_history, created_at
       FROM patients WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    return res.status(200).json({ success: true, patient: result.rows[0] });

  } catch (err) {
    console.error('Get patient profile error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { patientSignup, patientLogin, getPatientProfile };
