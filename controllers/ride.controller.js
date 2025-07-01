const Ride = require("../models/Ride");
const Location = require("../models/Location");

// Crear viaje (Pasajero)
exports.createRide = async (req, res) => {
  try {
    const { origin, destination, price_offered } = req.body;

    const ride = new Ride({
      passenger: req.userId,
      origin,
      destination,
      price_offered,
    });

    await ride.save();
    res.status(201).json(ride);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error al crear viaje", error: err.message });
  }
};

// Obtener viajes disponibles (Conductor)
exports.getAvailableRides = async (req, res) => {
  try {
    const rides = await Ride.find({ status: "buscando", driver: null });
    res.json(rides);
  } catch (err) {
    res.status(500).json({ message: "Error al obtener viajes disponibles" });
  }
};

// Aceptar viaje (Conductor)
exports.acceptRide = async (req, res) => {
  const rideId = req.params.rideId;
  const driverId = req.userId;
  const { price_accepted } = req.body;

  try {
    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ msg: "Viaje no encontrado" });
    if (ride.driver)
      return res.status(400).json({ msg: "Viaje ya fue aceptado" });

    ride.driver = driverId;
    ride.status = "aceptado";
    ride.price_accepted = price_accepted;
    await ride.save();

    const io = req.app.get("io");
    io.to(ride.passenger.toString()).emit("aceptado", {
      rideId: ride._id,
      driverId: driverId,
      status: ride.status,
    });

    res.json({ msg: "Viaje aceptado", ride });
  } catch (err) {
    res.status(500).json({ msg: "Error al aceptar viaje", error: err.message });
  }
};

// Actualizar estado del viaje (Pasajero o Conductor)
exports.updateRideStatus = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["en_curso", "finalizado", "cancelado"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Estado no válido." });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ message: "Viaje no encontrado" });

    if (
      ![ride.driver?.toString(), ride.passenger?.toString()].includes(
        req.userId
      )
    ) {
      return res
        .status(403)
        .json({ message: "No autorizado para actualizar este viaje" });
    }

    if (ride.status === "finalizado" || ride.status === "cancelado") {
      return res
        .status(400)
        .json({ message: "El viaje ya fue finalizado o cancelado" });
    }

    ride.status = status;
    await ride.save();

    const io = req.app.get("io");
    io.to(ride.passenger.toString()).emit("ride_status_updated", {
      rideId,
      status,
    });
    if (ride.driver) {
      io.to(ride.driver.toString()).emit("ride_status_updated", {
        rideId,
        status,
      });
    }

    res.json({ message: "Estado actualizado", ride });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error al actualizar estado", error: err.message });
  }
};

// Obtener viajes del usuario (Pasajero o Conductor)
exports.getMyRides = async (req, res) => {
  const userId = req.userId;
  try {
    const rides = await Ride.find({
      $or: [{ passenger: userId }, { driver: userId }],
      status: { $ne: "finalizado" },
    });
    res.json(rides);
  } catch (err) {
    res.status(500).json({ message: "Error al obtener viajes" });
  }
};

// Obtener viaje activo actual del usuario (rol dinámico)
exports.getActiveRide = async (req, res) => {
  try {
    const userId = req.userId;
    const role = req.user.role;

    const query = {
      status: { $in: ["buscando", "aceptado", "en_curso"] },
      [role === "pasajero" ? "passenger" : "driver"]: userId,
    };

    const ride = await Ride.findOne(query)
      .populate("passenger", "name email")
      .populate("driver", "name email")
      .sort({ createdAt: -1 });

    if (!ride)
      return res.status(404).json({ message: "No hay viajes activos." });

    let driverLocation = null;
    if (ride.driver) {
      const locationData = await Location.findOne({
        user: ride.driver._id,
      }).sort({ updatedAt: -1 });
      if (locationData) {
        driverLocation = {
          coordinates: locationData.coordinates,
          updatedAt: locationData.updatedAt,
        };
      }
    }

    const response = {
      ...ride.toObject(),
      driverLocation,
    };

    res.json(response);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error obteniendo viaje activo", error: err.message });
  }
};

// Obtener viaje por ID
exports.getRidesById = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.rideId)
      .populate("passenger", "name")
      .populate("driver", "name");
    res.json(ride);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener el viaje." });
  }
};
