const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role = "pasajero",
      dni,
      license,
      vehicle,
    } = req.body;

    // Validaciones mínimas
    if (!name || !email || !password) {
      return res.status(400).json({ msg: "Faltan datos obligatorios." });
    }

    // Validación extra para conductores
    if (role === "conductor") {
      const vehicleFields = vehicle || {};
      const fieldsMissing =
        !dni || !license ||
        !vehicleFields.brand || !vehicleFields.model ||
        !vehicleFields.color || !vehicleFields.year;

      if (fieldsMissing) {
        return res.status(400).json({ msg: "Faltan datos del conductor." });
      }
    }

    // Crear usuario
    const user = new User({
      name,
      email,
      password, // Suponiendo que tienes middleware de encriptación
      role,
    });

    // Agregar info del conductor si corresponde
    if (role === "conductor") {
      user.driverInfo = {
        dni,
        license,
        vehicle: {
          brand: vehicle.brand,
          model: vehicle.model,
          color: vehicle.color,
          year: vehicle.year,
        },
      };
    }

    await user.save();
    res.status(201).json({ msg: "Usuario registrado correctamente" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};


exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario por email
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });

    // Verificar contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ msg: "Contraseña incorrecta" });

    // Crear token (opcional, si estás usando JWT)
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });


    // Enviar respuesta con info del usuario
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        driverInfo: user.driverInfo || null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};
