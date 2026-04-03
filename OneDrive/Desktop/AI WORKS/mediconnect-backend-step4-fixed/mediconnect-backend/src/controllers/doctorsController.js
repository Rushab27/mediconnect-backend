const pool = require('../config/database');

// ─── ADD DOCTOR ───────────────────────────────────────────────────
const addDoctor = async (req, res) => {
  const { full_name, specialization, consultation_fee, phone, email, timings, bio } = req.body;
  const clinic_id = req.user.clinic_id; // from JWT — ensures doctor belongs to THIS clinic

  try {
    const result = await pool.query(
      `INSERT INTO doctors (clinic_id, full_name, specialization, consultation_fee, phone, email, timings, bio)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, full_name, specialization, consultation_fee, phone, email, timings`,
      [clinic_id, full_name, specialization, consultation_fee, phone || null, email || null, timings || null, bio || null]
    );

    return res.status(201).json({
      success: true,
      message: 'Doctor added successfully!',
      doctor: result.rows[0]
    });

  } catch (err) {
    console.error('Add doctor error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET ALL DOCTORS (for this clinic) ───────────────────────────
const getDoctors = async (req, res) => {
  const clinic_id = req.user.clinic_id;

  try {
    const result = await pool.query(
      `SELECT id, full_name, specialization, consultation_fee, phone, email, timings, bio, is_active
       FROM doctors 
       WHERE clinic_id = $1
       ORDER BY full_name ASC`,
      [clinic_id]
    );

    return res.status(200).json({
      success: true,
      doctors: result.rows
    });

  } catch (err) {
    console.error('Get doctors error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET SINGLE DOCTOR ────────────────────────────────────────────
const getDoctor = async (req, res) => {
  const { id } = req.params;
  const clinic_id = req.user.clinic_id;

  try {
    const result = await pool.query(
      `SELECT id, full_name, specialization, consultation_fee, phone, email, timings, bio, is_active
       FROM doctors 
       WHERE id = $1 AND clinic_id = $2`, // SECURITY: must belong to THIS clinic
      [id, clinic_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    return res.status(200).json({ success: true, doctor: result.rows[0] });

  } catch (err) {
    console.error('Get doctor error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── UPDATE DOCTOR ────────────────────────────────────────────────
const updateDoctor = async (req, res) => {
  const { id } = req.params;
  const clinic_id = req.user.clinic_id;
  const { full_name, specialization, consultation_fee, phone, email, timings, bio, is_active } = req.body;

  try {
    // SECURITY: verify doctor belongs to this clinic before updating
    const check = await pool.query(
      'SELECT id FROM doctors WHERE id = $1 AND clinic_id = $2',
      [id, clinic_id]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    const result = await pool.query(
      `UPDATE doctors 
       SET full_name = COALESCE($1, full_name),
           specialization = COALESCE($2, specialization),
           consultation_fee = COALESCE($3, consultation_fee),
           phone = COALESCE($4, phone),
           email = COALESCE($5, email),
           timings = COALESCE($6, timings),
           bio = COALESCE($7, bio),
           is_active = COALESCE($8, is_active),
           updated_at = NOW()
       WHERE id = $9 AND clinic_id = $10
       RETURNING id, full_name, specialization, consultation_fee, timings, is_active`,
      [full_name, specialization, consultation_fee, phone, email, timings, bio, is_active, id, clinic_id]
    );

    return res.status(200).json({
      success: true,
      message: 'Doctor updated successfully!',
      doctor: result.rows[0]
    });

  } catch (err) {
    console.error('Update doctor error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── DELETE DOCTOR ────────────────────────────────────────────────
const deleteDoctor = async (req, res) => {
  const { id } = req.params;
  const clinic_id = req.user.clinic_id;

  try {
    const result = await pool.query(
      'DELETE FROM doctors WHERE id = $1 AND clinic_id = $2 RETURNING id',
      [id, clinic_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    return res.status(200).json({ success: true, message: 'Doctor removed successfully.' });

  } catch (err) {
    console.error('Delete doctor error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── PUBLIC: Get doctors for a clinic (for patients to see) ──────
const getPublicDoctors = async (req, res) => {
  const { clinic_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, full_name, specialization, consultation_fee, timings, bio
       FROM doctors 
       WHERE clinic_id = $1 AND is_active = true
       ORDER BY full_name ASC`,
      [clinic_id]
    );

    return res.status(200).json({ success: true, doctors: result.rows });

  } catch (err) {
    console.error('Get public doctors error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { addDoctor, getDoctors, getDoctor, updateDoctor, deleteDoctor, getPublicDoctors };
