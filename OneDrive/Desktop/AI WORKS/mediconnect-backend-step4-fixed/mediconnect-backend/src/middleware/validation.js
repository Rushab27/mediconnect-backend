const { body, validationResult } = require('express-validator');

// Helper to check validation results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

// Rules for clinic signup
const clinicSignupRules = [
  body('clinic_name').trim().notEmpty().withMessage('Clinic name is required').isLength({ max: 100 }),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').trim().notEmpty().withMessage('Phone number is required').isLength({ min: 10, max: 15 }),
  body('address').trim().notEmpty().withMessage('Address is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
];

// Rules for patient signup
const patientSignupRules = [
  body('full_name').trim().notEmpty().withMessage('Full name is required').isLength({ max: 100 }),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').trim().notEmpty().withMessage('Phone number is required').isLength({ min: 10, max: 15 }),
  body('date_of_birth').optional().isDate().withMessage('Invalid date format'),
  body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Invalid gender value'),
];

// Rules for login (both clinic and patient)
const loginRules = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

// Rules for adding a doctor
const doctorRules = [
  body('full_name').trim().notEmpty().withMessage('Doctor name is required'),
  body('specialization').trim().notEmpty().withMessage('Specialization is required'),
  body('consultation_fee').isNumeric().withMessage('Consultation fee must be a number'),
  body('phone').optional().isLength({ min: 10, max: 15 }),
];

// Rules for booking appointment
const appointmentRules = [
  body('doctor_id').isInt().withMessage('Valid doctor ID is required'),
  body('clinic_id').isInt().withMessage('Valid clinic ID is required'),
  body('appointment_date').isDate().withMessage('Valid appointment date is required'),
  body('appointment_time').notEmpty().withMessage('Appointment time is required'),
  body('reason').optional().trim().isLength({ max: 500 }),
];

module.exports = {
  validate,
  clinicSignupRules,
  patientSignupRules,
  loginRules,
  doctorRules,
  appointmentRules,
};
