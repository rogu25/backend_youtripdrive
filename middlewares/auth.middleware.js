// middlewares/auth.middleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User"); // Necesitamos el modelo de usuario para buscarlo.

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Acceso denegado. No se proporcionó token de autorización." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "Acceso denegado. Usuario no encontrado o inactivo." });
    }

    req.user = user;
    req.userId = user._id;
    req.userRole = user.role;

    next();
  } catch (err) {
    console.error("Error de autenticación JWT:", err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: "Token expirado. Por favor, inicie sesión nuevamente." });
    }
    return res.status(401).json({ message: "Token inválido o no autorizado." });
  }
};

module.exports = authMiddleware; // <--- ¡IMPORTANTE! Exporta la función directamente