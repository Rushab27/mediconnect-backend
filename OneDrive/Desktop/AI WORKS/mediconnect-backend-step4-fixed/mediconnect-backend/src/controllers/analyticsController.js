const pool = require('../config/database');

// ─── CLINIC DASHBOARD STATS ───────────────────────────────────────
const getDashboardStats = async (req, res) => {
  const clinic_id = req.user.clinic_id;

  try {
    // Run all stats queries in parallel for speed
    const [
      totalPatients,
      todayAppointments,
      totalAppointments,
      totalDoctors,
      weeklyAppointments,
      recentAppointments,
      topDiseases
    ] = await Promise.all([

      // Total unique patients
      pool.query(
        'SELECT COUNT(DISTINCT patient_id) AS count FROM appointments WHERE clinic_id = $1',
        [clinic_id]
      ),

      // Today's appointments
      pool.query(
        `SELECT COUNT(*) AS count FROM appointments 
         WHERE clinic_id = $1 AND appointment_date = CURRENT_DATE`,
        [clinic_id]
      ),

      // Total appointments ever
      pool.query(
        'SELECT COUNT(*) AS count FROM appointments WHERE clinic_id = $1',
        [clinic_id]
      ),

      // Total active doctors
      pool.query(
        'SELECT COUNT(*) AS count FROM doctors WHERE clinic_id = $1 AND is_active = true',
        [clinic_id]
      ),

      // Last 7 days appointments per day
      pool.query(
        `SELECT appointment_date, COUNT(*) AS count 
         FROM appointments 
         WHERE clinic_id = $1 AND appointment_date >= CURRENT_DATE - INTERVAL '6 days'
         GROUP BY appointment_date 
         ORDER BY appointment_date ASC`,
        [clinic_id]
      ),

      // 5 most recent appointments
      pool.query(
        `SELECT a.id, a.appointment_date, a.appointment_time, a.status,
                p.full_name AS patient_name,
                d.full_name AS doctor_name
         FROM appointments a
         JOIN patients p ON a.patient_id = p.id
         JOIN doctors d ON a.doctor_id = d.id
         WHERE a.clinic_id = $1
         ORDER BY a.created_at DESC
         LIMIT 5`,
        [clinic_id]
      ),

      // Top diseases/reasons (from appointments reason field)
      pool.query(
        `SELECT reason, COUNT(*) AS count 
         FROM appointments 
         WHERE clinic_id = $1 AND reason IS NOT NULL AND reason != ''
         GROUP BY reason 
         ORDER BY count DESC 
         LIMIT 5`,
        [clinic_id]
      )
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        total_patients: parseInt(totalPatients.rows[0].count),
        today_appointments: parseInt(todayAppointments.rows[0].count),
        total_appointments: parseInt(totalAppointments.rows[0].count),
        total_doctors: parseInt(totalDoctors.rows[0].count),
      },
      weekly_appointments: weeklyAppointments.rows,
      recent_appointments: recentAppointments.rows,
      top_diseases: topDiseases.rows
    });

  } catch (err) {
    console.error('Dashboard stats error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── MONTHLY ANALYTICS ────────────────────────────────────────────
const getMonthlyAnalytics = async (req, res) => {
  const clinic_id = req.user.clinic_id;
  const { year, month } = req.query;

  try {
    const result = await pool.query(
      `SELECT 
         COUNT(*) AS total_appointments,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed,
         COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelled,
         COUNT(CASE WHEN status = 'no-show' THEN 1 END) AS no_show,
         COUNT(DISTINCT patient_id) AS unique_patients,
         SUM(CASE WHEN status = 'completed' THEN fees ELSE 0 END) AS total_revenue
       FROM appointments
       WHERE clinic_id = $1 
         AND EXTRACT(YEAR FROM appointment_date) = $2
         AND EXTRACT(MONTH FROM appointment_date) = $3`,
      [clinic_id, year || new Date().getFullYear(), month || new Date().getMonth() + 1]
    );

    return res.status(200).json({
      success: true,
      analytics: result.rows[0]
    });

  } catch (err) {
    console.error('Monthly analytics error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getDashboardStats, getMonthlyAnalytics };
