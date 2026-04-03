const pool = require('../config/database');

// ─── BOOK APPOINTMENT (by patient) ───────────────────────────────
const bookAppointment = async (req, res) => {
  const { doctor_id, clinic_id, appointment_date, appointment_time, reason } = req.body;
  const patient_id = req.user.id;

  try {
    // Verify the doctor belongs to the clinic (security)
    const doctorCheck = await pool.query(
      'SELECT id, full_name, consultation_fee FROM doctors WHERE id = $1 AND clinic_id = $2 AND is_active = true',
      [doctor_id, clinic_id]
    );
    if (doctorCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Doctor not found at this clinic.' });
    }

    // Check if slot already booked
    const slotCheck = await pool.query(
      `SELECT id FROM appointments 
       WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time = $3 
       AND status NOT IN ('cancelled')`,
      [doctor_id, appointment_date, appointment_time]
    );
    if (slotCheck.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'This time slot is already booked. Please choose another time.' });
    }

    const doctor = doctorCheck.rows[0];

    // Book appointment
    const result = await pool.query(
      `INSERT INTO appointments (patient_id, doctor_id, clinic_id, appointment_date, appointment_time, reason, fees)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, appointment_date, appointment_time, status, fees`,
      [patient_id, doctor_id, clinic_id, appointment_date, appointment_time, reason || null, doctor.consultation_fee]
    );

    return res.status(201).json({
      success: true,
      message: `Appointment booked successfully with Dr. ${doctor.full_name}!`,
      appointment: result.rows[0]
    });

  } catch (err) {
    console.error('Book appointment error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET APPOINTMENTS (clinic view — all appointments) ────────────
const getClinicAppointments = async (req, res) => {
  const clinic_id = req.user.clinic_id;
  const { date, doctor_id, status } = req.query;

  try {
    let query = `
      SELECT a.id, a.appointment_date, a.appointment_time, a.status, a.reason, a.fees,
             p.full_name AS patient_name, p.phone AS patient_phone,
             d.full_name AS doctor_name, d.specialization
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN doctors d ON a.doctor_id = d.id
      WHERE a.clinic_id = $1
    `;
    const params = [clinic_id];
    let paramCount = 1;

    if (date) {
      paramCount++;
      query += ` AND a.appointment_date = $${paramCount}`;
      params.push(date);
    }
    if (doctor_id) {
      paramCount++;
      query += ` AND a.doctor_id = $${paramCount}`;
      params.push(doctor_id);
    }
    if (status) {
      paramCount++;
      query += ` AND a.status = $${paramCount}`;
      params.push(status);
    }

    query += ' ORDER BY a.appointment_date ASC, a.appointment_time ASC';

    const result = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      total: result.rows.length,
      appointments: result.rows
    });

  } catch (err) {
    console.error('Get clinic appointments error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET APPOINTMENTS (patient view — their own only) ────────────
const getPatientAppointments = async (req, res) => {
  const patient_id = req.user.id;

  try {
    const result = await pool.query(
      `SELECT a.id, a.appointment_date, a.appointment_time, a.status, a.reason, a.fees,
              d.full_name AS doctor_name, d.specialization,
              c.clinic_name, c.phone AS clinic_phone, c.address
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.id
       JOIN clinics c ON a.clinic_id = c.id
       WHERE a.patient_id = $1
       ORDER BY a.appointment_date DESC`,
      [patient_id]
    );

    return res.status(200).json({
      success: true,
      appointments: result.rows
    });

  } catch (err) {
    console.error('Get patient appointments error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── UPDATE APPOINTMENT STATUS (clinic only) ─────────────────────
const updateAppointmentStatus = async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;
  const clinic_id = req.user.clinic_id;

  const validStatuses = ['confirmed', 'completed', 'cancelled', 'no-show'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status value.' });
  }

  try {
    // SECURITY: verify this appointment belongs to this clinic
    const result = await pool.query(
      `UPDATE appointments 
       SET status = $1, notes = COALESCE($2, notes), updated_at = NOW()
       WHERE id = $3 AND clinic_id = $4
       RETURNING id, status, appointment_date, appointment_time`,
      [status, notes, id, clinic_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    return res.status(200).json({
      success: true,
      message: `Appointment marked as ${status}.`,
      appointment: result.rows[0]
    });

  } catch (err) {
    console.error('Update appointment status error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── CANCEL APPOINTMENT (by patient) ─────────────────────────────
const cancelAppointment = async (req, res) => {
  const { id } = req.params;
  const patient_id = req.user.id;

  try {
    const result = await pool.query(
      `UPDATE appointments 
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND patient_id = $2 AND status = 'pending'
       RETURNING id, status`,
      [id, patient_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Appointment not found or cannot be cancelled.' 
      });
    }

    return res.status(200).json({ success: true, message: 'Appointment cancelled successfully.' });

  } catch (err) {
    console.error('Cancel appointment error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── TODAY'S APPOINTMENTS (clinic dashboard) ─────────────────────
const getTodaysAppointments = async (req, res) => {
  const clinic_id = req.user.clinic_id;

  try {
    const result = await pool.query(
      `SELECT a.id, a.appointment_time, a.status, a.reason,
              p.full_name AS patient_name, p.phone AS patient_phone,
              d.full_name AS doctor_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN doctors d ON a.doctor_id = d.id
       WHERE a.clinic_id = $1 AND a.appointment_date = CURRENT_DATE
       ORDER BY a.appointment_time ASC`,
      [clinic_id]
    );

    return res.status(200).json({
      success: true,
      date: new Date().toISOString().split('T')[0],
      total: result.rows.length,
      appointments: result.rows
    });

  } catch (err) {
    console.error('Get today appointments error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  bookAppointment,
  getClinicAppointments,
  getPatientAppointments,
  updateAppointmentStatus,
  cancelAppointment,
  getTodaysAppointments
};
