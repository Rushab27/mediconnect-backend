const jwt = require('jsonwebtoken');

// Middleware to verify any logged-in user (clinic OR patient)
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access denied. No token provided.' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, clinic_id }
    next();
  } catch (err) {
    return res.status(403).json({ 
      success: false, 
      message: 'Invalid or expired token. Please login again.' 
    });
  }
};

// Middleware to allow ONLY clinic/doctor/receptionist roles
const verifyClinic = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role === 'clinic' || req.user.role === 'doctor' || req.user.role === 'receptionist') {
      next();
    } else {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Clinic access required.' 
      });
    }
  });
};

// Middleware to allow ONLY patients
const verifyPatient = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role === 'patient') {
      next();
    } else {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Patient access required.' 
      });
    }
  });
};

module.exports = { verifyToken, verifyClinic, verifyPatient };
