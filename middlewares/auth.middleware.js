// middlewares/auth.middleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User"); // Necesitamos el modelo de usuario para buscarlo.

const authMiddleware = async (req, res, next) => {
  try { // Envuelve todo el bloque try-catch para manejar errores en la extracción/verificación del token también.
    const authHeader = req.headers.authorization;

    // 1. Verificar si el encabezado de autorización está presente y tiene el formato correcto.
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Acceso denegado. No se proporcionó token de autorización." });
    }

    // 2. Extraer el token.
    const token = authHeader.split(" ")[1];

    // 3. Verificar el token JWT.
    // El 'decoded' objeto contendrá los datos que pusiste en el token (id, role).
    // Es mejor extraer ambos si los necesitas.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4. Buscar el usuario en la base de datos.
    // Optimizaciones:
    // a) Si el rol es crítico para futuras autorizaciones, lo podemos obtener directamente del token
    //    en lugar de solo el ID.
    // b) Considera qué campos del usuario realmente necesitas aquí.
    //    Si solo necesitas el ID y el rol, no es necesario cargar todo el objeto User de la DB.
    //    Sin embargo, cargar el usuario completo permite futuras validaciones o acceso a otros datos.
    const user = await User.findById(decoded.id);

    // 5. Verificar si el usuario existe.
    if (!user) {
      // Si el usuario no se encuentra, podría significar que fue eliminado después de que se emitió el token.
      return res.status(401).json({ message: "Acceso denegado. Usuario no encontrado o inactivo." });
    }

    // 6. Adjuntar el usuario y su ID al objeto de solicitud para uso posterior en las rutas.
    req.user = user; // Adjunta el objeto completo del usuario
    req.userId = user._id; // <-- Correcto, ya lo tenías. Puede ser redundante si ya tienes req.user._id, pero no daña.
    req.userRole = user.role; // <-- Agregado: Útil para middlewares de autorización de rol.

    // 7. Pasar al siguiente middleware o a la función de la ruta.
    next();
  } catch (err) {
    // Manejo de errores de JWT (token expirado, inválido, etc.)
    console.error("Error de autenticación JWT:", err.message); // Log más específico
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: "Token expirado. Por favor, inicie sesión nuevamente." });
    }
    // Para otros errores de verificación (ej. JsonWebTokenError)
    return res.status(401).json({ message: "Token inválido o no autorizado." });
  }
};

module.exports = authMiddleware;