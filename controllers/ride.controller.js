// backend/controllers/rideController.js

const Ride = require("../models/Ride");
const Location = require("../models/Location");
const User = require("../models/User"); // Importar User (para autenticación y populate del pasajero)
const Driver = require("../models/Driver"); // <--- ¡¡¡LA IMPORTACIÓN QUE FALTABA Y CAUSABA EL ERROR!!!
const Maps_API_KEY = process.env.Maps_API_KEY;
const axios = require("axios");

// Función auxiliar para calcular la tarifa
const calculateFare = (distanceInKm, durationInMinutes) => {
  const baseFare = 2.5; // Tarifa base (en Soles Peruanos - PEN)
  const pricePerKm = 0.8; // Precio por kilómetro (en PEN)
  const pricePerMinute = 0.15; // Precio por minuto (en PEN)

  const fare =
    baseFare + distanceInKm * pricePerKm + durationInMinutes * pricePerMinute;
  return parseFloat(fare.toFixed(2)); // Redondear a 2 decimales
};

exports.getRideEstimate = async (req, res) => {
  const { origin, destination } = req.body;

  if (
    !origin ||
    !destination ||
    typeof origin !== "object" ||
    typeof destination !== "object"
  ) {
    return res.status(400).json({
      success: false,
      message: "Se requieren objetos de origen y destino válidos.",
    });
  }

  const simulatedDistanceKm = parseFloat((Math.random() * 22 + 3).toFixed(2));
  const simulatedDurationMinutes = Math.round(
    simulatedDistanceKm * (Math.random() * 1 + 2) + 5
  );
  const simulatedPolyline = null;

  try {
    const estimatedFare = calculateFare(
      simulatedDistanceKm,
      simulatedDurationMinutes
    );

    res.json({
      success: true,
      fare: estimatedFare,
      duration: simulatedDurationMinutes,
      distance: simulatedDistanceKm,
      polyline: simulatedPolyline,
      currency: "PEN",
    });
  } catch (error) {
    console.error(
      "Error interno al calcular la estimación del viaje:",
      error.message
    );
    res.status(500).json({
      success: false,
      message:
        "Error interno del servidor al calcular la estimación del viaje.",
    });
  }
};

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

exports.acceptRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.userId; // Este es el _id del 'User' que está autenticado
    const { price_accepted } = req.body;

    console.log(
      `[AcceptRide] DEBUG: Iniciando aceptación de viaje. rideId: ${rideId}, userId del solicitante (probablemente conductor): ${userId}`
    );

    // *** PASO CLAVE 1: Encontrar el documento Driver asociado al userId ***
    const driverProfile = await Driver.findOne({ userId: userId });

    console.log(`[AcceptRide] DEBUG: Resultado de buscar Driver para userId ${userId}:`, driverProfile);

    if (!driverProfile) {
      console.warn(`[AcceptRide] Perfil de conductor no encontrado para el usuario ${userId}.
        Esto puede deberse a que el usuario no tiene un perfil de Driver asociado o el Driver.findOne({ userId: userId }) falló.`);
      return res.status(404).json({ message: "Perfil de conductor no encontrado para el usuario." });
    }

    const driverId = driverProfile._id; // <-- ¡Este es el _id del documento Driver que debemos asignar al viaje!
    console.log(`[AcceptRide] DEBUG: Driver profile encontrado. El _id del Driver es: ${driverId}`);

    let ride = await Ride.findById(rideId);

    if (!ride) {
      console.warn(`[AcceptRide] Viaje ${rideId} no encontrado en la DB.`);
      return res.status(404).json({ message: "Viaje no encontrado." });
    }

    console.log(`[AcceptRide] DEBUG: Viaje encontrado. Estado actual: ${ride.status}`);

    if (ride.status !== "buscando") {
      console.warn(
        `[AcceptRide] DEBUG: Viaje ${rideId} no está en estado 'buscando'. Estado actual: ${ride.status}`
      );
      return res.status(400).json({
        message: "El viaje ya no está disponible o ha sido aceptado por otro conductor.",
      });
    }

    // *** PASO CLAVE 2: Asignar el _id del Driver al campo 'driver' del viaje ***
    ride.driver = driverId; // Asignamos el _id del DOCUMENTO DRIVER
    ride.status = "aceptado";
    ride.price_accepted = price_accepted || ride.price_offered;

    await ride.save();
    console.log(
      `[AcceptRide] DEBUG: Viaje ${rideId} guardado con nuevo estado 'aceptado' y Driver ID ${driverId}.`
    );

    const io = req.app.get("io");
    if (io) {
      console.log(
        `[AcceptRide] DEBUG: Instancia de Socket.IO disponible. Preparando populación para emisión.`
      );

      // Log para verificar el driverId antes de la populación (debería ser el ObjectId del Driver)
      console.log(`[AcceptRide] DEBUG: ride.driver (antes de populate):`, ride.driver);

      const fullRideData = await Ride.findById(rideId)
        .populate("passenger", "name email")
        .populate(
          "driver", // <-- Apunta al modelo 'Driver'
          "name carDetails.model carDetails.licensePlate carDetails.color currentLocation" // <-- Campos del modelo 'Driver'
        );

      // Log para verificar el driver object después de la populación
      console.log(`[AcceptRide] DEBUG: fullRideData.driver (después de populate):`, fullRideData.driver);

      if (!fullRideData) {
        console.error(
          `[AcceptRide] ERROR: fullRideData es null o undefined DESPUÉS de la populación. Esto es inusual si el rideId existe.`
        );
        throw new Error(
          "No se pudo obtener la información completa del viaje para la emisión del socket."
        );
      }

      // *** ¡Aquí estaba tu error! Esta comprobación ahora nos dirá si fullRideData.driver realmente está vacío ***
      if (!fullRideData.passenger || !fullRideData.driver) {
        console.error(
          `[AcceptRide] ERROR FINAL: fullRideData.passenger (${!!fullRideData.passenger}) o fullRideData.driver (${!!fullRideData.driver}) no fueron populados correctamente.
          Esto significa que el driverId (${driverId}) en el campo 'driver' del viaje NO CORRESPONDE a un documento REAL en la colección 'drivers' o los campos solicitados no existen en ese documento de Driver.`
        );
        throw new Error(
          "Datos de pasajero/conductor incompletos después de la populación para la emisión."
        );
      }

      io.to(fullRideData.passenger._id.toString()).emit("ride_accepted", {
        rideId: fullRideData._id.toString(),
        passengerId: fullRideData.passenger._id.toString(),
        driverId: fullRideData.driver._id.toString(),
        driverName: fullRideData.driver.name,
        driverVehicle: {
          model: fullRideData.driver.carDetails?.model,
          color: fullRideData.driver.carDetails?.color,
          licensePlate: fullRideData.driver.carDetails?.licensePlate,
        },
        driverLocation:
          fullRideData.driver.currentLocation &&
          typeof fullRideData.driver.currentLocation.latitude === 'number' &&
          typeof fullRideData.driver.currentLocation.longitude === 'number'
            ? {
                latitude: fullRideData.driver.currentLocation.latitude,
                longitude: fullRideData.driver.currentLocation.longitude,
              }
            : null,
        status: fullRideData.status,
        price_accepted: fullRideData.price_accepted,
      });

      console.log(
        `📡 [AcceptRide] DEBUG: Emitting ride_accepted to passenger ${fullRideData.passenger._id} for ride: ${fullRideData._id}`
      );
    } else {
      console.warn(
        '[AcceptRide] DEBUG: Socket.IO no disponible para emisión de "ride_accepted".'
      );
    }

    const responseRide = await Ride.findById(rideId)
      .populate("passenger", "name email")
      .populate(
        "driver",
        "name carDetails.model carDetails.licensePlate carDetails.color currentLocation"
      );

    console.log(`[AcceptRide] DEBUG: Enviando respuesta REST al conductor.`);
    res
      .status(200)
      .json({ message: "Viaje aceptado con éxito.", ride: responseRide });
  } catch (error) {
    console.error("❌ Error en acceptRide:", error);
    console.error("❌ Mensaje de error:", error.message);
    if (error.stack) {
      console.error("❌ Stack Trace:", error.stack);
    }

    if (error.name === "CastError") {
      console.error("Detalles de CastError (posible ID inválido):", error.message);
      return res.status(400).json({
        message: "ID de viaje o conductor inválido.",
        details: error.message
      });
    }
    if (error.name === "ValidationError") {
      console.error("Detalles de la validación fallida (Mongoose):", error.errors);
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

exports.updateRideStatus = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { status } = req.body;

    const userId = req.userId;
    const userRole = req.userRole;

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

    switch (status) {
      case "recogido":
        if (
          userRole !== "conductor" ||
          (ride.driver && !ride.driver.equals(userId)) // Usar .equals() para comparar ObjectIds
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

      case "en_ruta":
        if (
          userRole !== "conductor" ||
          (ride.driver && !ride.driver.equals(userId)) // Usar .equals()
        ) {
          return res.status(403).json({
            message: "Solo el conductor asignado puede iniciar el viaje.",
          });
        }
        if (!["aceptado", "recogido"].includes(ride.status)) {
          return res.status(400).json({
            message:
              "El viaje debe estar 'aceptado' o 'recogido' para iniciar la ruta.",
          });
        }
        break;

      case "finalizado":
        if (
          userRole !== "conductor" ||
          (ride.driver && !ride.driver.equals(userId)) // Usar .equals()
        ) {
          return res.status(403).json({
            message: "Solo el conductor asignado puede finalizar el viaje.",
          });
        }
        if (!["en_ruta", "recogido"].includes(ride.status)) {
          return res.status(400).json({
            message:
              "El viaje debe estar 'en_ruta' o 'recogido' para finalizarlo.",
          });
        }
        break;

      case "cancelado":
        // Primero, convertir userId a ObjectId para comparación con .equals()
        // const userIdObjectId = new mongoose.Types.ObjectId(userId); // Si userId viene como string, convertirlo.
        // Asumiendo que req.userId ya es un ObjectId o el middleware lo maneja.

        const isRequesterPassenger =
          ride.passenger && ride.passenger.equals(userId) && userRole === "pasajero";
        const isRequesterDriver =
          ride.driver && ride.driver.equals(userId) && userRole === "conductor";

        if (!isRequesterPassenger && !isRequesterDriver) {
          return res.status(403).json({
            message:
              "No autorizado para cancelar este viaje. Solo el pasajero o el conductor asignado pueden hacerlo.",
          });
        }
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

    const io = req.app.get("io");
    if (io) {
      const fullRideData = await Ride.findById(rideId)
        .populate("passenger", "_id")
        .populate("driver", "_id");

      if (fullRideData && fullRideData.passenger) {
        io.to(fullRideData.passenger._id.toString()).emit(
          "ride_status_update",
          {
            rideId: ride._id.toString(),
            status: ride.status,
          }
        );
        console.log(
          `📡 Emitting ride_status_update to passenger ${fullRideData.passenger._id} for ride ${ride._id}, new status: ${ride.status}`
        );
      }

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

exports.getMyRides = async (req, res) => {
  const userId = req.userId;

  try {
    const rides = await Ride.find({
      $or: [{ passenger: userId }, { driver: userId }],
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

exports.getActiveRide = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole; // Asumiendo que userRole viene directamente de req.userRole

    const query = {
      status: { $in: ["buscando", "aceptado", "recogido", "en_ruta"] },
      [userRole === "pasajero" ? "passenger" : "driver"]: userId,
    };

    const ride = await Ride.findOne(query)
      .populate("passenger", "name email")
      .populate(
        "driver",
        "name email carDetails.brand carDetails.model carDetails.color carDetails.licensePlate currentLocation" // Corregido: 'carDetails' en lugar de 'vehicle'
      )
      .sort({ createdAt: -1 });

    if (!ride) {
      return res
        .status(404)
        .json({ message: "No hay viajes activos para este usuario." });
    }

    let driverLocation = null;
    if (
      ride.driver &&
      ride.driver.currentLocation &&
      typeof ride.driver.currentLocation.latitude === 'number' && // Asegurar que son numbers
      typeof ride.driver.currentLocation.longitude === 'number'
    ) {
      driverLocation = {
        latitude: ride.driver.currentLocation.latitude,
        longitude: ride.driver.currentLocation.longitude,
      };
    } else if (ride.driver && ride.driver._id) { // Fallback solo si ride.driver existe y tiene _id
      // Fallback: Si el driver no tiene currentLocation populada directamente, busca en el modelo Location
      const locationData = await Location.findOne({ user: ride.driver._id });
      if (locationData && locationData.coordinates) {
        // Asumiendo que locationData.coordinates es un objeto { latitude, longitude }
        driverLocation = {
          latitude: locationData.coordinates.latitude,
          longitude: locationData.coordinates.longitude,
          updatedAt: locationData.updatedAt,
        };
      }
    }

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

exports.getRideById = async (req, res) => {
  try {
    const { rideId } = req.params;
    const ride = await Ride.findById(rideId)
      .populate("passenger", "name email")
      .populate(
        "driver",
        "name email carDetails.brand carDetails.model carDetails.color carDetails.licensePlate currentLocation" // Corregido: 'carDetails' en lugar de 'vehicle'
      );

    if (!ride) {
      return res.status(404).json({ message: "Viaje no encontrado." });
    }

    console.log(`[getRideById DEBUG] req.userId (from token): ${req.userId}`);
    console.log(`[getRideById DEBUG] ride.passenger: ${ride.passenger}`);
    console.log(`[getRideById DEBUG] ride.driver: ${ride.driver}`);

    const isCurrentPassenger =
      ride.passenger && ride.passenger._id.equals(req.userId);
    const isCurrentDriver = ride.driver && ride.driver._id.equals(req.userId);

    console.log(
      `[getRideById DEBUG] isCurrentPassenger (after .equals()): ${isCurrentPassenger}`
    );
    console.log(
      `[getRideById DEBUG] isCurrentDriver (after .equals()): ${isCurrentDriver}`
    );

    if (!isCurrentPassenger && !isCurrentDriver) {
      console.log(
        "[getRideById] DENYING ACCESS: User is neither passenger nor assigned driver."
      );
      return res
        .status(403)
        .json({ message: "No autorizado para ver este viaje." });
    }

    let driverLocation = null;
    if (
      ride.driver &&
      ride.driver.currentLocation &&
      typeof ride.driver.currentLocation.latitude === 'number' && // Asegurar que son numbers
      typeof ride.driver.currentLocation.longitude === 'number'
    ) {
      driverLocation = {
        latitude: ride.driver.currentLocation.latitude,
        longitude: ride.driver.currentLocation.longitude,
      };
    } else if (ride.driver && ride.driver._id) { // Fallback solo si ride.driver existe y tiene _id
      const locationData = await Location.findOne({ user: ride.driver._id });
      if (locationData && locationData.coordinates) {
        driverLocation = {
          latitude: locationData.coordinates.latitude,
          longitude: locationData.coordinates.longitude,
          updatedAt: locationData.updatedAt,
        };
      }
    }

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

exports.cancelRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;

    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({ message: "Viaje no encontrado." });
    }

    const isRequesterPassenger =
      ride.passenger && ride.passenger.equals(userId) && userRole === "pasajero";
    const isRequesterDriver =
      ride.driver && ride.driver.equals(userId) && userRole === "conductor";

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
      if (ride.passenger) {
        io.to(ride.passenger.toString()).emit("ride_status_update", {
          rideId: ride._id.toString(),
          status: "cancelado",
        });
        console.log(
          `📡 Emitting ride_status_update (cancelado) to passenger ${ride.passenger} for ride ${ride._id}`
        );
      }
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