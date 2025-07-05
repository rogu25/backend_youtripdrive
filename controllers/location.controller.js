// controllers/location.controller.js (VERSION CORREGIDA BASADA EN LA DISCUSIÓN)
const User = require("../models/User"); // Todavía puede ser útil para validaciones o para poblar
const Location = require("../models/Location"); // Ahora este es el modelo principal para ubicaciones actuales de drivers.

// Actualiza la ubicación actual de un conductor
// Esto se llamará desde POST /api/location/update
exports.updateCurrentLocation = async (req, res) => {
  const userId = req.userId; // Obtenido del token JWT
  const { latitude, longitude } = req.body; // Nombres consistentes con el esquema y frontend

  // Validación básica
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return res
      .status(400)
      .json({
        message:
          "Datos de ubicación inválidos. Se esperan números para latitud y longitud.",
      });
  }

  try {
    // Opcional: Verificar que el usuario sea un conductor antes de permitirle actualizar su ubicación.
    const user = await User.findById(userId);
    if (!user || user.role !== "conductor") {
      // <--- ¿Aquí podría estar el problema?
      return res
        .status(403)
        .json({
          message:
            "Acceso denegado. Solo los conductores pueden actualizar su ubicación.",
        });
    }

    // Busca si ya existe un documento de ubicación para este usuario
    let locationRecord = await Location.findOne({ user: userId });

    if (locationRecord) {
      // Si existe, actualiza sus coordenadas y la fecha de actualización
      locationRecord.coordinates = { latitude, longitude };
      // `updatedAt` se actualizará automáticamente si usas timestamps en tu Location schema
      await locationRecord.save();
    } else {
      // Si no existe, crea un nuevo registro de ubicación
      locationRecord = new Location({
        user: userId,
        coordinates: { latitude, longitude },
      });
      await locationRecord.save();
    }

    res
      .status(200)
      .json({ message: "Ubicación del conductor actualizada correctamente." });
  } catch (err) {
    console.error(
      "❌ Error al actualizar la ubicación del conductor:",
      err.message
    ); // <--- Este es el mensaje de error que esperaría ver en la consola del backend.
    res
      .status(500)
      .json({
        message: "Error interno del servidor al actualizar la ubicación.",
      }); // <--- Este es el mensaje que el frontend recibe.
  }
};

// Obtiene la última ubicación conocida de un conductor específico
// Esto se llamará desde GET /api/location/:driverId
exports.getDriverCurrentLocation = async (req, res) => {
  const { driverId } = req.params;

  try {
    // Busca el registro de ubicación del conductor en el modelo Location
    const driverLocation = await Location.findOne({ user: driverId }).populate(
      "user",
      "name role"
    ); // Opcional: poblar info del usuario

    if (!driverLocation) {
      return res
        .status(404)
        .json({
          message: "Ubicación del conductor no encontrada o no disponible.",
        });
    }

    // Opcional: Verificar que el usuario asociado al registro de ubicación sea realmente un conductor
    // if (driverLocation.user && driverLocation.user.role !== 'conductor') {
    //   return res.status(404).json({ message: "ID no corresponde a un conductor válido." });
    // }

    res.status(200).json({
      userId: driverLocation.user
        ? driverLocation.user._id
        : driverLocation.user, // si poblado o no
      userName: driverLocation.user ? driverLocation.user.name : null,
      latitude: driverLocation.coordinates.latitude,
      longitude: driverLocation.coordinates.longitude,
      lastUpdated: driverLocation.updatedAt,
    });
  } catch (err) {
    console.error(
      "❌ Error al obtener la ubicación del conductor:",
      err.message
    );
    res
      .status(500)
      .json({
        message:
          "Error interno del servidor al obtener la ubicación del conductor.",
      });
  }
};
