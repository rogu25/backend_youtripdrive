const Ride = require("../models/Ride");
const Location = require("../models/Location"); // Necesario para obtener la ubicación del conductor

// NOTA IMPORTANTE: req.app.get("io") requiere que 'io' sea establecido en server.js
// como lo hicimos en la revisión de server.js.

// 1. Crear viaje (Pasajero)
exports.createRide = async (req, res) => {
  try {
    // req.userId viene del authMiddleware y es el ID del pasajero.
    // Usar 'latitude' y 'longitude' para consistencia con el esquema Ride.js
    const { origin, destination, price_offered } = req.body;

    // Validación de campos requeridos
    if (
      !origin ||
      !origin.latitude ||
      !origin.longitude ||
      !destination ||
      !destination.latitude ||
      !destination.longitude ||
      typeof price_offered !== "number" ||
      price_offered < 0
    ) {
      return res
        .status(400)
        .json({ message: "Datos de viaje incompletos o inválidos." });
    }

    // Opcional: Validar que el usuario que crea el viaje sea un pasajero
    // if (req.user.role !== 'pasajero') {
    //   return res.status(403).json({ message: "Solo los pasajeros pueden crear viajes." });
    // }

    // Verifica si el pasajero ya tiene un viaje activo (para evitar múltiples solicitudes)
    const existingActiveRide = await Ride.findOne({
      passenger: req.userId,
      status: { $in: ["buscando", "aceptado", "en_curso"] },
    });

    if (existingActiveRide) {
      return res.status(409).json({
        // 409 Conflict es apropiado
        message: "Ya tienes un viaje activo o pendiente.",
        ride: existingActiveRide,
      });
    }

    // Crea el nuevo viaje. Usar 'latitude'/'longitude' aquí.
    const ride = new Ride({
      passenger: req.userId,
      origin: {
        latitude: origin.latitude,
        longitude: origin.longitude,
        address: origin.address || null, // Si tienes el campo address en el esquema Ride
      },
      destination: {
        latitude: destination.latitude,
        longitude: destination.longitude,
        address: destination.address || null, // Si tienes el campo address en el esquema Ride
      },
      price_offered,
      status: "buscando", // Se establece por defecto en el esquema, pero explicitarlo no está mal
    });

    await ride.save();

    // ✅ Opcional: Emitir un evento Socket.IO para notificar a los conductores disponibles sobre el nuevo viaje
    const io = req.app.get("io");
    if (io) {
      // Puedes emitir a una sala específica de 'conductores_disponibles' o a todos
      io.emit("new_ride_request", ride); // Envía el viaje recién creado
      console.log(`📡 Emitting new_ride_request for ride: ${ride._id}`);
    }

    res.status(201).json({ message: "Viaje creado exitosamente.", ride });
  } catch (err) {
    console.error("❌ Error al crear viaje:", err.message);
    res
      .status(500)
      .json({ message: "Error interno del servidor al crear el viaje." });
  }
};

// 2. Obtener viajes disponibles (Conductor)
exports.getAvailableRides = async (req, res) => {
  try {
    // Opcional: Validar que el usuario que consulta sea un conductor
    // if (req.user.role !== 'conductor') {
    //   return res.status(403).json({ message: "Solo los conductores pueden ver viajes disponibles." });
    // }

    const rides = await Ride.find({
      status: "buscando",
      driver: null, // Solo viajes sin conductor asignado
      // Opcional: Filtrar por conductores que no han rechazado este viaje
      // rejectedDrivers: { $ne: req.userId }
    }).populate("passenger", "name email"); // Popular información básica del pasajero

    res.status(200).json(rides);
  } catch (err) {
    console.error("❌ Error al obtener viajes disponibles:", err.message);
    res
      .status(500)
      .json({
        message: "Error interno del servidor al obtener viajes disponibles.",
      });
  }
};

// 3. Aceptar viaje (Conductor)

exports.acceptRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const driverId = req.userId; // El ID del conductor que viene del authMiddleware
    const { price_accepted } = req.body; // El precio aceptado del frontend

    // 1. Encontrar el viaje por su ID
    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({ message: "Viaje no encontrado." });
    }

    // 2. Validar el estado del viaje (solo se puede aceptar si está "buscando")
    if (ride.status !== "buscando") {
      return res
        .status(400)
        .json({
          message:
            "El viaje ya no está disponible o ha sido aceptado por otro conductor.",
        });
    }

    // 3. Asignar el conductor y actualizar el estado
    // ¡IMPORTANTE AQUÍ! Solo actualiza los campos específicos.
    ride.driver = driverId;
    ride.status = "aceptado";
    ride.price_accepted = price_accepted || ride.price_offered; // Asigna el precio aceptado o el precio_offered si no se envía uno nuevo

    // 4. Guardar los cambios en la base de datos
    await ride.save(); // Mongoose valida el documento completo, pero como no modificamos los campos requeridos, no habrá problema.

    // 5. Opcional: Notificar al pasajero vía Socket.IO
    const io = req.app.get("io");
    if (io) {
      // Popula el pasajero para enviar sus detalles al conductor
      const populatedRide = await Ride.findById(rideId)
        .populate("passenger", "name email")
        .populate("driver", "name vehicleModel vehiclePlate"); // También popula conductor

      // Envía el viaje actualizado y populado al pasajero
      io.to(ride.passenger.toString()).emit("ride_accepted", populatedRide);
      console.log(
        `📡 Emitting ride_accepted to passenger ${ride.passenger} for ride: ${ride._id}`
      );
    }

    // 6. Enviar respuesta exitosa al frontend
    res.status(200).json({ message: "Viaje aceptado con éxito.", ride: ride });
  } catch (error) {
    console.error("❌ Error al aceptar viaje:", error.message);
    // Puedes añadir un log más detallado del error de validación de Mongoose
    if (error.name === "ValidationError") {
      console.error("Detalles de la validación fallida:", error.errors);
      return res
        .status(400)
        .json({
          message: "Error de validación del viaje.",
          errors: error.errors,
        });
    }
    res
      .status(500)
      .json({ message: "Error interno del servidor al aceptar el viaje." });
  }
};

// 4. Actualizar estado del viaje (Pasajero o Conductor)
exports.updateRideStatus = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { status } = req.body;

    // CAMBIO AQUÍ: Leer directamente de req.userId y req.userRole
    const userId = req.userId; // <--- ¡CORREGIDO!
    const userRole = req.userRole; // <--- ¡CORREGIDO!

    console.log(
      `[DEBUG] updateRideStatus - rideId: ${rideId}, newStatus: ${status}`
    );
    console.log(
      `[DEBUG] updateRideStatus - userId: ${userId}, userRole: ${userRole}`
    );

    const ride = await Ride.findById(rideId);

    if (!ride) {
      console.log(`[DEBUG] Viaje no encontrado para rideId: ${rideId}`);
      return res.status(404).json({ message: "Viaje no encontrado." });
    }

    console.log(
      `[DEBUG] Viaje encontrado - ride.status: ${
        ride.status
      }, ride.driver: ${ride.driver?.toString()}`
    );

    // Reglas de negocio para transiciones de estado:
    if (status === "en_curso") {
      console.log(
        `[DEBUG] Intentando pasar a 'en_curso'. userRole: ${userRole}, ride.driver: ${ride.driver?.toString()}, userId: ${userId}`
      );
      if (
        userRole !== "conductor" ||
        ride.driver?.toString() !== userId.toString()
      ) {
        // Añadir .toString() para seguridad en la comparación de ObjectIds
        console.log("[DEBUG] Falló la verificación de conductor asignado.");
        // Cambiar el mensaje de error para que coincida con lo que el frontend espera
        return res
          .status(403)
          .json({
            message:
              "No autorizado para actualizar el estado de este viaje. Solo el conductor asignado puede iniciarlo.",
          });
      }
      if (ride.status !== "aceptado") {
        console.log(`[DEBUG] Estado actual no es 'aceptado': ${ride.status}`);
        return res
          .status(400)
          .json({
            message: "El viaje debe estar en estado 'aceptado' para iniciar.",
          });
      }
    } else if (status === "finalizado") {
      console.log(
        `[DEBUG] Intentando pasar a 'finalizado'. userRole: ${userRole}, ride.driver: ${ride.driver?.toString()}, userId: ${userId}`
      );
      if (
        userRole !== "conductor" ||
        ride.driver?.toString() !== userId.toString()
      ) {
        // Añadir .toString()
        console.log(
          "[DEBUG] Falló la verificación de conductor asignado para finalizar."
        );
        return res
          .status(403)
          .json({
            message:
              "No autorizado para actualizar el estado de este viaje. Solo el conductor asignado puede finalizarlo.",
          });
      }
      if (ride.status !== "en_curso") {
        console.log(
          `[DEBUG] Estado actual no es 'en_curso' para finalizar: ${ride.status}`
        );
        return res
          .status(400)
          .json({
            message: "El viaje debe estar en estado 'en_curso' para finalizar.",
          });
      }
    } else if (status === "cancelado") {
      console.log(
        `[DEBUG] Intentando pasar a 'cancelado'. userRole: ${userRole}, ride.passenger: ${ride.passenger?.toString()}, ride.driver: ${ride.driver?.toString()}, userId: ${userId}`
      );

      const isRequesterPassenger =
        ride.passenger?.toString() === userId.toString() &&
        userRole === "pasajero"; // Añadir .toString()
      const isRequesterDriver =
        ride.driver?.toString() === userId.toString() &&
        userRole === "conductor"; // Añadir .toString()

      if (!isRequesterPassenger && !isRequesterDriver) {
        console.log(
          "[DEBUG] El usuario no es ni el pasajero ni el conductor asignado."
        );
        return res
          .status(403)
          .json({
            message:
              "No autorizado para actualizar el estado de este viaje. Solo el pasajero o el conductor asignado pueden cancelarlo.",
          });
      }
    } else {
      console.log(`[DEBUG] Estado de transición no válido: ${status}`);
      return res
        .status(400)
        .json({ message: "Estado de viaje no válido para transición." });
    }

    ride.status = status;
    await ride.save();

    console.log(`[DEBUG] Viaje ${rideId} actualizado a estado: ${status}`);
    res.json({ message: `Estado del viaje actualizado a ${status}`, ride });
  } catch (error) {
    console.error(
      `[DEBUG] Error en updateRideStatus para rideId ${req.params.rideId}:`,
      error
    );
    res
      .status(500)
      .json({ message: "Error interno del servidor.", error: error.message });
  }
};

// 5. Obtener viajes del usuario (Pasajero o Conductor)
exports.getMyRides = async (req, res) => {
  const userId = req.userId;
  // const userRole = req.user.role; // Puede ser útil para filtrar o popular de manera diferente

  try {
    // Filtramos los viajes que no han sido 'finalizado' o 'cancelado' (asumo que se quieren los activos/pendientes)
    // O puedes obtener todos y filtrar en el frontend si es mucha información.
    const rides = await Ride.find({
      $or: [{ passenger: userId }, { driver: userId }],
      status: { $nin: ["finalizado", "cancelado"] }, // Excluir finalizados y cancelados.
    })
      .populate("passenger", "name email") // Poblar datos del pasajero
      .populate("driver", "name email"); // Poblar datos del conductor

    res.status(200).json(rides);
  } catch (err) {
    console.error("❌ Error al obtener viajes del usuario:", err.message);
    res
      .status(500)
      .json({ message: "Error interno del servidor al obtener viajes." });
  }
};

// 6. Obtener viaje activo actual del usuario (rol dinámico)
exports.getActiveRide = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.user.role; // Asegúrate de que req.user.role esté disponible del authMiddleware

    const query = {
      status: { $in: ["buscando", "aceptado", "en_curso"] },
      // Construye la query dinámicamente según el rol
      [userRole === "pasajero" ? "passenger" : "driver"]: userId,
    };

    const ride = await Ride.findOne(query)
      .populate("passenger", "name email")
      .populate("driver", "name email")
      .sort({ createdAt: -1 }); // Obtiene el más reciente si hay varios activos (raro, pero como fallback)

    if (!ride) {
      return res
        .status(404)
        .json({ message: "No hay viajes activos para este usuario." });
    }

    let driverLocation = null;
    // Solo busca la ubicación del conductor si hay un conductor asignado al viaje
    if (ride.driver && ride.driver._id) {
      // Asegurarse que el driver esté populado y tenga _id
      const locationData = await Location.findOne({
        user: ride.driver._id, // Usar el ID del driver
      }); // No se necesita sort({ updatedAt: -1 }) si 'Location' tiene unique: true en 'user'

      if (locationData) {
        // Asegurarse de que los nombres de los campos coincidan con el esquema Location
        driverLocation = {
          latitude: locationData.coordinates.latitude, // <-- CAMBIADO de 'coordinates.lat'
          longitude: locationData.coordinates.longitude, // <-- CAMBIADO de 'coordinates.lng'
          updatedAt: locationData.updatedAt,
        };
      }
    }

    // Combina los datos del viaje con la ubicación del conductor
    const response = {
      ...ride.toObject({ getters: true, virtuals: true }), // Usar toObject con getters/virtuals para una salida limpia
      driverLocation,
    };

    res.status(200).json(response); // Siempre 200 OK para respuestas exitosas
  } catch (err) {
    console.error("❌ Error obteniendo viaje activo:", err.message);
    res
      .status(500)
      .json({
        message: "Error interno del servidor al obtener el viaje activo.",
      });
  }
};

// 7. Obtener viaje por ID
exports.getRideById = async (req, res) => {
  // Renombrado de getRidesById a getRideById (es por un solo ID)
  try {
    const { rideId } = req.params;
    const ride = await Ride.findById(rideId)
      .populate("passenger", "name email") // Añadido email
      .populate("driver", "name email"); // Añadido email

    if (!ride) {
      return res.status(404).json({ message: "Viaje no encontrado." });
    }

    // Opcional: Asegurar que solo el pasajero, conductor o un admin puedan ver los detalles de un viaje específico
    // if (![ride.passenger?.toString(), ride.driver?.toString()].includes(req.userId) && req.user.role !== 'admin') {
    //   return res.status(403).json({ message: "No autorizado para ver este viaje." });
    // }

    res.status(200).json(ride);
  } catch (err) {
    console.error("❌ Error al obtener el viaje por ID:", err.message);
    // Verificar si el error es por un ID inválido de MongoDB
    if (err.name === "CastError") {
      return res.status(400).json({ message: "ID de viaje inválido." });
    }
    res
      .status(500)
      .json({ message: "Error interno del servidor al obtener el viaje." });
  }
};

exports.cancelRide = async (req, res) => {
  try {
    const { id } = req.params; // El ID del viaje viene de la URL
    // Aquí deberías tener la lógica para buscar el viaje por ID
    // y actualizar su estado a 'cancelado' en la base de datos.
    // Por ejemplo:
    const ride = await Ride.findById(id); // Asumiendo que has importado tu modelo Ride
    if (!ride) {
      return res.status(404).json({ message: "Viaje no encontrado." });
    }
    if (ride.status === "finalizado" || ride.status === "cancelado") {
      return res
        .status(400)
        .json({ message: "El viaje ya está finalizado o cancelado." });
    }

    ride.status = "cancelado"; // Cambia el estado del viaje
    await ride.save(); // Guarda los cambios

    // Opcional: Emitir un evento de socket si el conductor estaba asignado
    // if (ride.driver) {
    //     req.app.get('io').to(ride.driver.socketId).emit('ride_cancelled', { rideId: ride._id });
    // }

    res.status(200).json({ message: "Viaje cancelado exitosamente.", ride });
  } catch (error) {
    console.error("Error al cancelar el viaje:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor al cancelar el viaje." });
  }
};
