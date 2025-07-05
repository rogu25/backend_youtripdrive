const User = require("../models/User");
const bcrypt = require("bcryptjs"); // Necesitas bcryptjs para hashear la contraseña antes de guardar.
const jwt = require("jsonwebtoken"); // Para generar tokens JWT.

exports.register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role = "pasajero", // Valor por defecto. Correcto.
      dni,
      license,
      vehicle, // 'vehicle' ahora se espera como un objeto en el cuerpo de la solicitud
    } = req.body;

    // 1. Validación de campos obligatorios básicos
    if (!name || !email || !password) {
      return res.status(400).json({ msg: "Faltan datos obligatorios: nombre, email y contraseña." });
    }

    // 2. Validar formato de email (opcional pero recomendado)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ msg: "Formato de email inválido." });
    }

    // 3. Validar que el rol sea uno de los permitidos
    const allowedRoles = ["pasajero", "conductor"]; // Define los roles válidos
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ msg: "Rol inválido. Los roles permitidos son 'pasajero' o 'conductor'." });
    }

    // 4. Verificar si el email ya está registrado
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ msg: "El email ya está registrado." }); // 409 Conflict es más apropiado aquí.
    }

    // 5. Validación extra para conductores
    let driverInfo = null; // Inicializar driverInfo para el nuevo usuario

    if (role === "conductor") {
      // Es importante que 'vehicle' sea un objeto, si no lo es, lanzar error.
      if (!dni || !license || !vehicle || typeof vehicle !== 'object') {
          return res.status(400).json({ msg: "Faltan datos de conductor o el formato del vehículo es incorrecto." });
      }

      // Validar campos específicos del vehículo
      const { brand, model, color, year } = vehicle;
      if (!brand || !model || !color || !year) {
        return res.status(400).json({ msg: "Faltan datos del vehículo (marca, modelo, color, año)." });
      }

      // Validar que 'year' sea un número válido (ej. 4 dígitos y en un rango razonable)
      if (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 2) { // Año no puede ser en el futuro lejano
        return res.status(400).json({ msg: "Año del vehículo inválido." });
      }

      driverInfo = {
        dni,
        license,
        vehicle: { brand, model, color, year: parseInt(year) }, // Asegura que 'year' sea un número
      };
    }

    // 6. Encriptar contraseña (MUY IMPORTANTE)
    // Actualmente, tu código guarda 'password' directamente. Esto es una VULNERABILIDAD.
    // Deberías hashear la contraseña antes de guardarla.
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 7. Crear usuario
    const newUser = new User({
      name,
      email,
      password: hashedPassword, // GUARDAR LA CONTRASEÑA HASHEADA
      role,
      driverInfo: driverInfo, // Asignar driverInfo si existe, de lo contrario será null
    });

    await newUser.save();
    res.status(201).json({ msg: "Usuario registrado correctamente" });

  } catch (error) {
    console.error("Error en el registro de usuario:", error);
    // Si el error es una violación de unicidad (ej. email ya existe, aunque ya lo validamos explícitamente),
    // el código de estado puede ser 409. Si es otro error de base de datos o interno, 500.
    // Para simplificar, mantenemos 500 para errores no capturados por las validaciones explícitas.
    res.status(500).json({ msg: "Error en el servidor al registrar el usuario" });
  }
};


exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validar campos de entrada
    if (!email || !password) {
      return res.status(400).json({ msg: "Faltan credenciales: email y contraseña." });
    }

    // 2. Buscar usuario por email
    // Usar .select('+password') si tu modelo User tiene 'password' con 'select: false'
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ msg: "Credenciales inválidas" }); // No decir "usuario no encontrado" para no dar pistas a atacantes
    }

    // 3. Verificar contraseña
    // ¡Asegúrate de que 'user.password' sea la contraseña hasheada, no la plana!
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ msg: "Credenciales inválidas" }); // El mismo mensaje para usuario/contraseña incorrectos
    }

    // 4. Crear token JWT
    // process.env.JWT_SECRET debe estar definido en tu archivo .env
    const token = jwt.sign(
      { id: user._id, role: user.role }, // Incluir el rol en el token es útil para la autorización.
      process.env.JWT_SECRET,
      { expiresIn: "7d" } // Token expira en 7 días
    );

    // 5. Enviar respuesta con información del usuario
    // No enviar la contraseña, incluso si está hasheada.
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        // Solo incluir driverInfo si el rol es conductor y existe, para no enviar 'null' innecesariamente.
        ...(user.role === "conductor" && user.driverInfo && { driverInfo: user.driverInfo }),
      },
    });
  } catch (err) {
    console.error("Error en el login de usuario:", err);
    res.status(500).json({ msg: "Error en el servidor al iniciar sesión" });
  }
};

// Dentro de controllers/auth.controller.js, después de exports.login o al final
exports.getMe = async (req, res) => {
  try {
    // req.user ya está disponible gracias al authMiddleware
    // Asegúrate de no enviar campos sensibles como la contraseña hasheada
    const user = req.user;

    res.status(200).json({
      message: "Autenticación exitosa",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        // Incluir driverInfo solo si es un conductor y existe
        ...(user.role === "conductor" && user.driverInfo && { driverInfo: user.driverInfo }),
        // Puedes añadir otros campos que consideres relevantes para el perfil del usuario
        // currentLocation: user.currentLocation, // si quieres que el perfil muestre su ubicación actual
      },
    });
  } catch (error) {
    console.error("Error al obtener información del usuario:", error);
    res.status(500).json({ message: "Error en el servidor al obtener el perfil del usuario." });
  }
};