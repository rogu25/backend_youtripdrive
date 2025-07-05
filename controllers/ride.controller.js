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
    if (!origin || !origin.latitude || !origin.longitude ||
        !destination || !destination.latitude || !destination.longitude ||
        typeof price_offered !== 'number' || price_offered < 0) {
      return res.status(400).json({ message: "Datos de viaje incompletos o inválidos." });
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
      return res.status(409).json({ // 409 Conflict es apropiado
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
    res.status(500).json({ message: "Error interno del servidor al crear el viaje." });
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
    })
      .populate("passenger", "name email"); // Popular información básica del pasajero

    res.status(200).json(rides);
  } catch (err) {
    console.error("❌ Error al obtener viajes disponibles:", err.message);
    res.status(500).json({ message: "Error interno del servidor al obtener viajes disponibles." });
  }
};

// 3. Aceptar viaje (Conductor)
exports.acceptRide = async (req, res) => {
  const { rideId } = req.params;
  const driverId = req.userId; // ID del conductor autenticado
  const { price_accepted } = req.body;

  try {
    // Validar price_accepted
    if (typeof price_accepted !== 'number' || price_accepted < 0) {
      return res.status(400).json({ message: "El precio aceptado es inválido." });
    }

    // Opcional: Validar que el usuario que acepta sea un conductor
    // if (req.user.role !== 'conductor') {
    //   return res.status(403).json({ message: "Solo los conductores pueden aceptar viajes." });
    // }

    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({ message: "Viaje no encontrado." });
    }
    // Si la idea es que solo un conductor pueda aceptar un viaje en estado 'buscando'
    if (ride.status !== "buscando" || ride.driver !== null) {
      return res.status(400).json({ message: "Este viaje ya no está disponible o ha sido aceptado." });
    }

    // Actualizar el viaje
    ride.driver = driverId;
    ride.status = "aceptado";
    ride.price_accepted = price_accepted;

    // Opcional: Añadir el conductor a rejectedDrivers de otros viajes que ha rechazado,
    // o limpiar de rejectedDrivers si previamente lo había rechazado (no aplica aquí).
    // Si tienes `acceptedDrivers` array en el modelo, podrías añadir la oferta del conductor allí.

    await ride.save();

    const io = req.app.get("io");
    if (io) {
      // Emitir al pasajero específico que su viaje ha sido aceptado
      io.to(ride.passenger.toString()).emit("ride_accepted", {
        rideId: ride._id,
        driverId: driverId,
        status: ride.status,
        price_accepted: ride.price_accepted,
      });
      // Opcional: También podrías notificar a otros conductores si tienes lógica de "cancelar para otros"
      console.log(`📡 Emitting ride_accepted to passenger: ${ride.passenger.toString()} for ride: ${ride._id}`);
    }

    res.status(200).json({ message: "Viaje aceptado exitosamente.", ride });
  } catch (err) {
    console.error("❌ Error al aceptar viaje:", err.message);
    res.status(500).json({ message: "Error interno del servidor al aceptar el viaje." });
  }
};

// 4. Actualizar estado del viaje (Pasajero o Conductor)
exports.updateRideStatus = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { status } = req.body; // El nuevo estado
    const userId = req.userId; // El usuario que realiza la solicitud
    const userRole = req.user.role; // El rol del usuario (pasajero o conductor)

    // console.log("lo que contiene rideId:", rideId); // Remover en prod
    // console.log("lo que contiene status:", status); // Remover en prod

    const allowedStatuses = ["en_curso", "finalizado", "cancelado"]; // 'aceptado' se maneja en acceptRide
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Estado de viaje inválido." });
    }

    const ride = await Ride.findById(rideId);
    // console.log("lo que contiene ride:", ride); // Remover en prod

    if (!ride) {
      return res.status(404).json({ message: "Viaje no encontrado." });
    }

    // Reglas de transición de estado y autorización:
    // Solo el pasajero o el conductor asignado pueden actualizar el estado.
    const isAuthorized = ride.passenger?.toString() === userId || ride.driver?.toString() === userId;
    if (!isAuthorized) {
      return res.status(403).json({ message: "No autorizado para actualizar el estado de este viaje." });
    }

    // Reglas de negocio para transiciones de estado:
    // Un viaje 'finalizado' o 'cancelado' no puede cambiar de estado.
    if (["finalizado", "cancelado"].includes(ride.status)) {
      return res.status(400).json({ message: `El viaje ya está en estado '${ride.status}' y no puede ser modificado.` });
    }

    // Permisos específicos por rol para cada transición
    if (status === "en_curso") {
      // Solo el conductor asignado puede iniciar el viaje
      if (userRole !== 'conductor' || ride.driver?.toString() !== userId) {
        return res.status(403).json({ message: "Solo el conductor asignado puede iniciar el viaje." });
      }
      if (ride.status !== "aceptado") {
        return res.status(400).json({ message: "El viaje debe estar en estado 'aceptado' para iniciar." });
      }
    } else if (status === "finalizado") {
      // Solo el conductor asignado puede finalizar el viaje
      if (userRole !== 'conductor' || ride.driver?.toString() !== userId) {
        return res.status(403).json({ message: "Solo el conductor asignado puede finalizar el viaje." });
      }
      if (ride.status !== "en_curso") {
        return res.status(400).json({ message: "El viaje debe estar en estado 'en_curso' para finalizar." });
      }
    } else if (status === "cancelado") {
      // Tanto el pasajero como el conductor pueden cancelar, pero con condiciones:
      // Si el viaje está buscando o aceptado, ambos pueden cancelar.
      // Si está en curso, solo el conductor o un admin podría cancelarlo (o tener una lógica de penalización).
      // Para simplificar, permitimos que ambos cancelen si no está finalizado/cancelado.
      if (ride.status === "finalizado") { // Redundante por la verificación de arriba, pero explícito
        return res.status(400).json({ message: "No se puede cancelar un viaje finalizado." });
      }
      // Podrías añadir lógica de negocio compleja aquí (ej. penalizaciones por cancelación)
    }

    // Actualizar el estado del viaje
    ride.status = status;
    await ride.save();

    const io = req.app.get("io");
    if (io) {
      // Emitir a la sala de chat del viaje si tienes una
      io.to(`ride_${rideId}`).emit("ride_status_updated", {
        rideId,
        status,
        updatedBy: userId, // Útil para saber quién hizo el cambio
      });
      // También emitir a las salas personales del pasajero y conductor
      io.to(ride.passenger.toString()).emit("ride_status_updated", { rideId, status });
      if (ride.driver) {
        io.to(ride.driver.toString()).emit("ride_status_updated", { rideId, status });
      }
      console.log(`📡 Emitting ride_status_updated for ride: ${ride._id} to status: ${status}`);
    }

    res.status(200).json({ message: `Estado del viaje actualizado a '${status}'.`, ride });
  } catch (err) {
    console.error("❌ Error al actualizar estado del viaje:", err);
    res.status(500).json({ message: "Error interno del servidor al actualizar estado.", error: err.message });
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
    res.status(500).json({ message: "Error interno del servidor al obtener viajes." });
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
      return res.status(404).json({ message: "No hay viajes activos para este usuario." });
    }

    let driverLocation = null;
    // Solo busca la ubicación del conductor si hay un conductor asignado al viaje
    if (ride.driver && ride.driver._id) { // Asegurarse que el driver esté populado y tenga _id
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
    res.status(500).json({ message: "Error interno del servidor al obtener el viaje activo." });
  }
};

// 7. Obtener viaje por ID
exports.getRideById = async (req, res) => { // Renombrado de getRidesById a getRideById (es por un solo ID)
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
    if (err.name === 'CastError') {
      return res.status(400).json({ message: "ID de viaje inválido." });
    }
    res.status(500).json({ message: "Error interno del servidor al obtener el viaje." });
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
            return res.status(404).json({ message: 'Viaje no encontrado.' });
        }
        if (ride.status === 'finalizado' || ride.status === 'cancelado') {
            return res.status(400).json({ message: 'El viaje ya está finalizado o cancelado.' });
        }
        
        ride.status = 'cancelado'; // Cambia el estado del viaje
        await ride.save(); // Guarda los cambios
        
        // Opcional: Emitir un evento de socket si el conductor estaba asignado
        // if (ride.driver) {
        //     req.app.get('io').to(ride.driver.socketId).emit('ride_cancelled', { rideId: ride._id });
        // }

        res.status(200).json({ message: 'Viaje cancelado exitosamente.', ride });

    } catch (error) {
        console.error('Error al cancelar el viaje:', error);
        res.status(500).json({ message: 'Error interno del servidor al cancelar el viaje.' });
    }
};