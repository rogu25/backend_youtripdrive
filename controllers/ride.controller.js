const Ride = require("../models/Ride");
const Location = require("../models/Location"); // Necesario para obtener la ubicación del conductor
const User = require("../models/User"); // Para popular datos de conductor/pasajero si es necesario

// NOTA IMPORTANTE: req.app.get("io") requiere que 'io' sea establecido en server.js
// como lo hicimos en la revisión de server.js.

// 1. Crear viaje (Pasajero)
exports.createRide = async (req, res) => {
  try {
    const { origin, destination, price_offered } = req.body;

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

    const existingActiveRide = await Ride.findOne({
      passenger: req.userId,
      // <<< MODIFICACIÓN: Actualiza los estados activos según el enum definitivo >>>
      status: { $in: ["buscando", "aceptado", "recogido", "en_ruta"] },
    });

    if (existingActiveRide) {
      return res.status(409).json({
        message: "Ya tienes un viaje activo o pendiente.",
        ride: existingActiveRide,
      });
    }

    const ride = new Ride({
      passenger: req.userId,
      origin: {
        latitude: origin.latitude,
        longitude: origin.longitude,
        address: origin.address || null,
      },
      destination: {
        latitude: destination.latitude,
        longitude: destination.longitude,
        address: destination.address || null,
      },
      price_offered,
      status: "buscando",
    });

    await ride.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("new_ride_request", ride);
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
    const rides = await Ride.find({
      status: "buscando",
      driver: null,
    }).populate("passenger", "name email");

    res.status(200).json(rides);
  } catch (err) {
    console.error("❌ Error al obtener viajes disponibles:", err.message);
    res.status(500).json({
      message: "Error interno del servidor al obtener viajes disponibles.",
    });
  }
};

// 3. Aceptar viaje (Conductor)
exports.acceptRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const driverId = req.userId;
    const { price_accepted } = req.body;

    console.log(
      `[AcceptRide] Intentando aceptar viaje ${rideId} por conductor ${driverId}`
    );

    let ride = await Ride.findById(rideId);

    if (!ride) {
      console.warn(`[AcceptRide] Viaje ${rideId} no encontrado.`);
      return res.status(404).json({ message: "Viaje no encontrado." });
    }

    console.log(`[AcceptRide] Viaje encontrado. Estado actual: ${ride.status}`);

    if (ride.status !== "buscando") {
      console.warn(
        `[AcceptRide] Viaje ${rideId} no está en estado 'buscando'. Estado actual: ${ride.status}`
      );
      return res.status(400).json({
        message:
          "El viaje ya no está disponible o ha sido aceptado por otro conductor.",
      });
    }

    ride.driver = driverId;
    ride.status = "aceptado"; // <<< ESTADO FIJO AQUÍ >>>
    ride.price_accepted = price_accepted || ride.price_offered;

    await ride.save();
    console.log(
      `[AcceptRide] Viaje ${rideId} guardado con nuevo estado 'aceptado' y driver ${driverId}.`
    );

    const io = req.app.get("io");
    if (io) {
      console.log(
        `[AcceptRide] Instancia de Socket.IO disponible. Populando datos para socket.`
      );
      const fullRideData = await Ride.findById(rideId)
        .populate("passenger", "name email")
        .populate(
          "driver",
          "name vehicle.brand vehicle.model vehicle.color vehicle.licensePlate currentLocation"
        );

      if (!fullRideData) {
        console.error(
          `[AcceptRide] ERROR: fullRideData es null o undefined después de la populación para socket.`
        );
        throw new Error(
          "No se pudo obtener la información completa del viaje para la emisión del socket."
        );
      }

      if (!fullRideData.passenger || !fullRideData.driver) {
        console.error(
          `[AcceptRide] ERROR: Pasajero o Conductor no populados en fullRideData.`
        );
        throw new Error(
          "Datos de pasajero/conductor incompletos para la emisión del socket."
        );
      }

      // Emitir a la sala del pasajero que el viaje fue aceptado
      io.to(fullRideData.passenger._id.toString()).emit("ride_accepted", {
        rideId: fullRideData._id.toString(),
        passengerId: fullRideData.passenger._id.toString(),
        driverId: fullRideData.driver._id.toString(),
        driverName: fullRideData.driver.name,
        driverVehicle: {
          brand: fullRideData.driver.vehicle?.brand,
          model: fullRideData.driver.vehicle?.model,
          color: fullRideData.driver.vehicle?.color,
          licensePlate: fullRideData.driver.vehicle?.licensePlate,
        },
        driverLocation:
          fullRideData.driver.currentLocation &&
          fullRideData.driver.currentLocation.coordinates
            ? {
                latitude: fullRideData.driver.currentLocation.coordinates[1],
                longitude: fullRideData.driver.currentLocation.coordinates[0],
              }
            : null,
        status: fullRideData.status,
        price_accepted: fullRideData.price_accepted,
      });

      console.log(
        `📡 [AcceptRide] Emitting ride_accepted to passenger ${fullRideData.passenger._id} for ride: ${fullRideData._id}`
      );
    } else {
      console.warn(
        '[AcceptRide] Socket.IO no disponible para emisión de "ride_accepted".'
      );
    }

    const responseRide = await Ride.findById(rideId)
      .populate("passenger", "name email")
      .populate(
        "driver",
        "name vehicle.brand vehicle.model vehicle.color vehicle.licensePlate currentLocation"
      );

    console.log(`[AcceptRide] Enviando respuesta REST al conductor.`);
    res
      .status(200)
      .json({ message: "Viaje aceptado con éxito.", ride: responseRide });
  } catch (error) {
    console.error("❌ Error en acceptRide:", error);
    console.error("❌ Mensaje de error:", error.message);
    if (error.stack) {
      console.error("❌ Stack Trace:", error.stack);
    }

    if (error.name === "ValidationError") {
      console.error("Detalles de la validación fallida:", error.errors);
      return res.status(400).json({
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
    const { status } = req.body; // Nuevo estado al que se quiere cambiar

    const userId = req.userId;
    const userRole = req.userRole; // Asegúrate de que userRole venga del middleware de autenticación

    console.log(
      `[updateRideStatus] rideId: ${rideId}, newStatus: ${status}, userId: ${userId}, userRole: ${userRole}`
    );

    const ride = await Ride.findById(rideId);

    if (!ride) {
      console.warn(`[updateRideStatus] Viaje no encontrado: ${rideId}`);
      return res.status(404).json({ message: "Viaje no encontrado." });
    }

    console.log(
      `[updateRideStatus] Viaje actual - status: ${
        ride.status
      }, driver: ${ride.driver?.toString()}`
    );

    // <<< MODIFICACIÓN: Validación y transiciones de estado según el enum definitivo >>>
    switch (status) {
      case "recogido": // Conductor confirma que recogió al pasajero
        if (
          userRole !== "conductor" ||
          ride.driver?.toString() !== userId.toString()
        ) {
          return res.status(403).json({
            message:
              "Solo el conductor asignado puede marcar el viaje como 'recogido'.",
          });
        }
        if (ride.status !== "aceptado") {
          return res.status(400).json({
            message:
              "El viaje debe estar 'aceptado' para marcar como 'recogido'.",
          });
        }
        break;

      case "en_ruta": // Conductor inicia el viaje hacia el destino final
        if (
          userRole !== "conductor" ||
          ride.driver?.toString() !== userId.toString()
        ) {
          return res.status(403).json({
            message: "Solo el conductor asignado puede iniciar el viaje.",
          });
        }
        // Puede pasar de 'aceptado' (si no se usa 'recogido') o de 'recogido'
        if (!["aceptado", "recogido"].includes(ride.status)) {
          return res.status(400).json({
            message:
              "El viaje debe estar 'aceptado' o 'recogido' para iniciar la ruta.",
          });
        }
        break;

      case "finalizado": // Conductor finaliza el viaje
        if (
          userRole !== "conductor" ||
          ride.driver?.toString() !== userId.toString()
        ) {
          return res.status(403).json({
            message: "Solo el conductor asignado puede finalizar el viaje.",
          });
        }
        // Puede finalizar desde 'en_ruta' o 'recogido' (en casos de interrupción temprana)
        if (!["en_ruta", "recogido"].includes(ride.status)) {
          return res.status(400).json({
            message:
              "El viaje debe estar 'en_ruta' o 'recogido' para finalizarlo.",
          });
        }
        // Opcional: Registrar `endTime` o `finalPrice` aquí si aplica
        // ride.endTime = new Date();
        // ride.finalPrice = calculateFinalPrice(ride);
        break;

      case "cancelado": // Pasajero o Conductor cancela el viaje
        const isRequesterPassenger =
          ride.passenger?.toString() === userId.toString() &&
          userRole === "pasajero";
        const isRequesterDriver =
          ride.driver?.toString() === userId.toString() &&
          userRole === "conductor";

        if (!isRequesterPassenger && !isRequesterDriver) {
          return res.status(403).json({
            message:
              "No autorizado para cancelar este viaje. Solo el pasajero o el conductor asignado pueden hacerlo.",
          });
        }
        // Prevenir cancelación si ya está finalizado o cancelado
        if (["finalizado", "cancelado"].includes(ride.status)) {
          return res
            .status(400)
            .json({ message: "El viaje ya está finalizado o cancelado." });
        }
        break;

      default:
        return res
          .status(400)
          .json({ message: "Estado de viaje no válido para transición." });
    }

    ride.status = status;
    await ride.save();

    // <<< MODIFICACIÓN: Emitir eventos de Socket.IO para el pasajero con el nuevo estado >>>
    const io = req.app.get("io");
    if (io) {
      const fullRideData = await Ride.findById(rideId)
        .populate("passenger", "_id") // Solo necesitamos el ID del pasajero para la sala
        .populate("driver", "_id"); // Solo necesitamos el ID del conductor para la sala

      if (fullRideData && fullRideData.passenger) {
        // Emitir a la sala del pasajero
        io.to(fullRideData.passenger._id.toString()).emit(
          "ride_status_update",
          {
            rideId: ride._id.toString(),
            status: ride.status,
            // Puedes incluir más datos si el frontend los necesita al cambiar de estado
          }
        );
        console.log(
          `📡 Emitting ride_status_update to passenger ${fullRideData.passenger._id} for ride ${ride._id}, new status: ${ride.status}`
        );
      }

      // Opcional: Si el conductor cancela el viaje, también puedes notificarlo de alguna manera
      if (status === "cancelado" && fullRideData && fullRideData.driver) {
        io.to(fullRideData.driver._id.toString()).emit("ride_status_update", {
          rideId: ride._id.toString(),
          status: ride.status,
        });
        console.log(
          `📡 Emitting ride_status_update to driver ${fullRideData.driver._id} for ride ${ride._id}, new status: ${ride.status}`
        );
      }
    }

    console.log(
      `[updateRideStatus] Viaje ${rideId} actualizado a estado: ${status}`
    );
    res.json({ message: `Estado del viaje actualizado a ${status}`, ride });
  } catch (error) {
    console.error(
      `❌ Error en updateRideStatus para rideId ${req.params.rideId}:`,
      error
    );
    if (error.name === "CastError") {
      return res.status(400).json({ message: "ID de viaje inválido." });
    }
    res
      .status(500)
      .json({ message: "Error interno del servidor.", error: error.message });
  }
};

// 5. Obtener viajes del usuario (Pasajero o Conductor)
exports.getMyRides = async (req, res) => {
  const userId = req.userId;

  try {
    const rides = await Ride.find({
      $or: [{ passenger: userId }, { driver: userId }],
      // <<< MODIFICACIÓN: Excluir 'finalizado' y 'cancelado' (mantiene la lógica de "activos/pendientes") >>>
      status: { $nin: ["finalizado", "cancelado"] },
    })
      .populate("passenger", "name email")
      .populate("driver", "name email");

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
    const userRole = req.user.role;

    const query = {
      // <<< MODIFICACIÓN: Incluye 'recogido' y 'en_ruta' como estados activos >>>
      status: { $in: ["buscando", "aceptado", "recogido", "en_ruta"] },
      [userRole === "pasajero" ? "passenger" : "driver"]: userId,
    };

    const ride = await Ride.findOne(query)
      .populate("passenger", "name email")
      .populate(
        "driver",
        "name email vehicle.brand vehicle.model vehicle.color vehicle.licensePlate currentLocation"
      ) // <<< MODIFICACIÓN: Popular información del vehículo y currentLocation del conductor >>>
      .sort({ createdAt: -1 });

    if (!ride) {
      return res
        .status(404)
        .json({ message: "No hay viajes activos para este usuario." });
    }

    // En exports.getRideById y exports.getActiveRide:

    // ...
    let driverLocation = null;
    if (
      ride.driver &&
      ride.driver.currentLocation &&
      ride.driver.currentLocation.coordinates
    ) {
      // Asegúrate de que coordinates es un array y tiene al menos 2 elementos
      if (
        Array.isArray(ride.driver.currentLocation.coordinates) &&
        ride.driver.currentLocation.coordinates.length >= 2
      ) {
        driverLocation = {
          latitude: ride.driver.currentLocation.coordinates[1],
          longitude: ride.driver.currentLocation.coordinates[0],
        };
      } else {
        console.warn(
          `[getRideById/getActiveRide] Driver ${ride.driver._id} has currentLocation but coordinates are invalid.`
        );
      }
    } else if (ride.driver) {
      // Fallback: Si el driver no tiene currentLocation populada directamente, busca en el modelo Location
      const locationData = await Location.findOne({ user: ride.driver._id });
      if (locationData && locationData.coordinates) {
        // Asumiendo que locationData.coordinates ya tiene latitude y longitude nombradas
        driverLocation = {
          latitude: locationData.coordinates.latitude,
          longitude: locationData.coordinates.longitude,
          updatedAt: locationData.updatedAt,
        };
      }
    }
    // ...

    const response = {
      ...ride.toObject({ getters: true, virtuals: true }),
      driverLocation,
    };

    res.status(200).json(response);
  } catch (err) {
    console.error("❌ Error obteniendo viaje activo:", err.message);
    res.status(500).json({
      message: "Error interno del servidor al obtener el viaje activo.",
    });
  }
};

// 7. Obtener viaje por ID
exports.getRideById = async (req, res) => {
  try {
    const { rideId } = req.params;
    const ride = await Ride.findById(rideId)
      .populate("passenger", "name email")
      .populate(
        "driver",
        "name email vehicle.brand vehicle.model vehicle.color vehicle.licensePlate currentLocation"
      );

    if (!ride) {
      return res.status(404).json({ message: "Viaje no encontrado." });
    }

    // DEBUG LOGS (mantenlos por ahora, son muy útiles)
    console.log(`[getRideById DEBUG] req.userId (from token): ${req.userId}`); // Esto es un ObjectId
    console.log(`[getRideById DEBUG] ride.passenger: ${ride.passenger}`); // Esto es un objeto populado, ride.passenger._id es el ObjectId
    console.log(`[getRideById DEBUG] ride.driver: ${ride.driver}`); // Esto es un objeto populado o null/undefined

    // <<< MODIFICACIÓN CLAVE AQUÍ: Usar .equals() >>>
    const isCurrentPassenger =
      ride.passenger && ride.passenger._id.equals(req.userId);
    const isCurrentDriver = ride.driver && ride.driver._id.equals(req.userId);

    console.log(
      `[getRideById DEBUG] isCurrentPassenger (after .equals()): ${isCurrentPassenger}`
    );
    console.log(
      `[getRideById DEBUG] isCurrentDriver (after .equals()): ${isCurrentDriver}`
    );
    // --- FIN LOGS DE DEPURACIÓN CRUCIALES ---

    // Lógica de autorización simplificada y robusta
    if (!isCurrentPassenger && !isCurrentDriver) {
      console.log(
        "[getRideById] DENYING ACCESS: User is neither passenger nor assigned driver."
      );
      return res
        .status(403)
        .json({ message: "No autorizado para ver este viaje." });
    }

    // Opcional: Adjuntar la ubicación actual del conductor si el viaje lo tiene asignado
    // En exports.getRideById y exports.getActiveRide:

    // ...
    let driverLocation = null;
    if (
      ride.driver &&
      ride.driver.currentLocation &&
      ride.driver.currentLocation.coordinates
    ) {
      // Asegúrate de que coordinates es un array y tiene al menos 2 elementos
      if (
        Array.isArray(ride.driver.currentLocation.coordinates) &&
        ride.driver.currentLocation.coordinates.length >= 2
      ) {
        driverLocation = {
          latitude: ride.driver.currentLocation.coordinates[1],
          longitude: ride.driver.currentLocation.coordinates[0],
        };
      } else {
        console.warn(
          `[getRideById/getActiveRide] Driver ${ride.driver._id} has currentLocation but coordinates are invalid.`
        );
      }
    } else if (ride.driver) {
      // Fallback: Si el driver no tiene currentLocation populada directamente, busca en el modelo Location
      const locationData = await Location.findOne({ user: ride.driver._id });
      if (locationData && locationData.coordinates) {
        // Asumiendo que locationData.coordinates ya tiene latitude y longitude nombradas
        driverLocation = {
          latitude: locationData.coordinates.latitude,
          longitude: locationData.coordinates.longitude,
          updatedAt: locationData.updatedAt,
        };
      }
    }
    // ...

    const response = {
      ...ride.toObject({ getters: true, virtuals: true }),
      driverLocation,
    };

    res.status(200).json(response);
  } catch (err) {
    console.error("❌ Error al obtener el viaje por ID:", err.message);
    if (err.name === "CastError") {
      return res.status(400).json({ message: "ID de viaje inválido." });
    }
    res
      .status(500)
      .json({ message: "Error interno del servidor al obtener el viaje." });
  }
};

// 8. Nuevo endpoint para cancelar viaje (ya lo tenías, solo una pequeña revisión)
// Lo movemos de 'updateRideStatus' a un endpoint dedicado para mayor claridad si prefieres.
// Sin embargo, mi sugerencia es que `cancelRide` use `updateRideStatus` internamente o que
// `updateRideStatus` sea la única forma de cambiar el estado de un viaje.
// Por ahora, lo dejaré tal cual lo tenías, pero con la sugerencia.
// Si deseas, podemos eliminar esta función y usar solo updateRideStatus con status: "cancelado".
exports.cancelRide = async (req, res) => {
  try {
    const { rideId } = req.params; // Cambiado de 'id' a 'rideId' para consistencia con otros endpoints
    const userId = req.userId;
    const userRole = req.userRole;

    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({ message: "Viaje no encontrado." });
    }

    // <<< Reutiliza la lógica de validación de `updateRideStatus` para `cancelado` >>>
    const isRequesterPassenger =
      ride.passenger?.toString() === userId.toString() &&
      userRole === "pasajero";
    const isRequesterDriver =
      ride.driver?.toString() === userId.toString() && userRole === "conductor";

    if (!isRequesterPassenger && !isRequesterDriver) {
      return res
        .status(403)
        .json({ message: "No autorizado para cancelar este viaje." });
    }

    if (["finalizado", "cancelado"].includes(ride.status)) {
      return res
        .status(400)
        .json({ message: "El viaje ya está finalizado o cancelado." });
    }

    ride.status = "cancelado";
    await ride.save();

    const io = req.app.get("io");
    if (io) {
      // Notificar al pasajero (si el conductor canceló)
      if (ride.passenger) {
        io.to(ride.passenger.toString()).emit("ride_status_update", {
          rideId: ride._id.toString(),
          status: "cancelado",
        });
        console.log(
          `📡 Emitting ride_status_update (cancelado) to passenger ${ride.passenger} for ride ${ride._id}`
        );
      }
      // Notificar al conductor (si el pasajero canceló)
      if (ride.driver) {
        io.to(ride.driver.toString()).emit("ride_status_update", {
          rideId: ride._id.toString(),
          status: "cancelado",
        });
        console.log(
          `📡 Emitting ride_status_update (cancelado) to driver ${ride.driver} for ride ${ride._id}`
        );
      }
    }

    res.status(200).json({ message: "Viaje cancelado exitosamente.", ride });
  } catch (error) {
    console.error("Error al cancelar el viaje:", error);
    if (error.name === "CastError") {
      return res.status(400).json({ message: "ID de viaje inválido." });
    }
    res
      .status(500)
      .json({ message: "Error interno del servidor al cancelar el viaje." });
  }
};
