const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// ─── CLINIC SIGNUP ───────────────────────────────────────────────
const clinicSignup = async (req, res) => {
  const { clinic_name, email, password, phone, address, city, specialization } = req.body;

  try {
    // Check if email already exists
    const existing = await pool.query(
      'SELECT id FROM clinics WHERE email = $1', [email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'Email already registered. Please login.' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Insert clinic into database
    const result = await pool.query(
      `INSERT INTO clinics (clinic_name, email, password, phone, address, city, specialization)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, clinic_name, email, phone, city`,
      [clinic_name, email, hashedPassword, phone, address, city, specialization || null]
    );

    const clinic = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { id: clinic.id, role: 'clinic', clinic_id: clinic.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Clinic registered successfully!',
      token,
      clinic: {
        id: clinic.id,
        clinic_name: clinic.clinic_name,
        email: clinic.email,
        phone: clinic.phone,
        city: clinic.city
      }
    });

  } catch (err) {
    console.error('Clinic signup error:', err.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error. Please try again.' 
    });
  }
};

// ─── CLINIC LOGIN ─────────────────────────────────────────────────
const clinicLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find clinic by email
    const result = await pool.query(
      'SELECT * FROM clinics WHERE email = $1', [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password.' 
      });
    }

    const clinic = result.rows[0];

    // Check password
    const isMatch = await bcrypt.compare(password, clinic.password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password.' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: clinic.id, role: 'clinic', clinic_id: clinic.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      clinic: {
        id: clinic.id,
        clinic_name: clinic.clinic_name,
        email: clinic.email,
        phone: clinic.phone,
        city: clinic.city,
        address: clinic.address,
        specialization: clinic.specialization
      }
    });

  } catch (err) {
    console.error('Clinic login error:', err.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error. Please try again.' 
    });
  }
};

// ─── GET CLINIC PROFILE ───────────────────────────────────────────
const getClinicProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, clinic_name, email, phone, address, city, specialization, 
              whatsapp_number, created_at
       FROM clinics WHERE id = $1`,
      [req.user.clinic_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Clinic not found.' });
    }

    return res.status(200).json({ success: true, clinic: result.rows[0] });

  } catch (err) {
    console.error('Get clinic profile error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── UPDATE CLINIC PROFILE ────────────────────────────────────────
const updateClinicProfile = async (req, res) => {
  const { clinic_name, phone, address, city, specialization, whatsapp_number } = req.body;

  try {
    const result = await pool.query(
      `UPDATE clinics 
       SET clinic_name = COALESCE($1, clinic_name),
           phone = COALESCE($2, phone),
           address = COALESCE($3, address),
           city = COALESCE($4, city),
           specialization = COALESCE($5, specialization),
           whatsapp_number = COALESCE($6, whatsapp_number),
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, clinic_name, email, phone, address, city, specialization, whatsapp_number`,
      [clinic_name, phone, address, city, specialization, whatsapp_number, req.user.clinic_id]
    );

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully!',
      clinic: result.rows[0]
    });

  } catch (err) {
    console.error('Update clinic profile error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { clinicSignup, clinicLogin, getClinicProfile, updateClinicProfile };
