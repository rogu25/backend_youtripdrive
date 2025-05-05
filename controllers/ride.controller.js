const Ride = require("../models/Ride");

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
    res.status(500).json({ message: "Error al crear viaje", error: err.message });
  }
};

exports.getAvailableRides = async (req, res) => {
  try {
    const rides = await Ride.find({ status: "requested", driver: null }).populate("passenger");
    res.json(rides);
  } catch (err) {
    res.status(500).json({ message: "Error al obtener viajes disponibles", error: err.message });
  }
};


exports.acceptRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { price_accepted } = req.body;

    const ride = await Ride.findById(rideId);
    console.log("que contiene RIDE: ", ride)
    if (!ride) return res.status(404).json({ message: "Viaje no encontrado" });

    if (ride.status !== "requested")
      return res.status(400).json({ message: "Viaje ya fue tomado" });

    ride.driver = req.userId;
    ride.status = "accepted";
    ride.price_accepted = price_accepted;

    await ride.save();
    res.json(ride);
  } catch (err) {
    res.status(500).json({ message: "Error al aceptar viaje", error: err.message });
  }
};


exports.updateRideStatus = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["in_progress", "completed", "cancelled"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Estado no válido." });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ message: "Viaje no encontrado" });

    // Solo pasajero o conductor asignado pueden actualizar
    if (![ride.driver?.toString(), ride.passenger?.toString()].includes(req.userId)) {
      return res.status(403).json({ message: "No autorizado para actualizar este viaje" });
    }

    // Control de transición de estados opcional
    if (ride.status === "completed" || ride.status === "cancelled") {
      return res.status(400).json({ message: "El viaje ya fue finalizado" });
    }

    ride.status = status;
    await ride.save();

    // Emitir evento a pasajero y conductor
    const io = req.app.get("io");
    io.to(ride.passenger.toString()).emit("ride_status_updated", { rideId: ride._id, status });
    if (ride.driver) {
      io.to(ride.driver.toString()).emit("ride_status_updated", { rideId: ride._id, status });
    }
  
    res.json({ message: "Estado actualizado", ride });
  } catch (err) {
    res.status(500).json({ message: "Error al actualizar estado", error: err.message });
  }

  //--------------------

};

exports.getMyRides = async (req, res) => {
  const userId = req.userId;
  try {
    const rides = await Ride.find({
      $or: [{ passenger: userId }, { driver: userId }],
      status: { $ne: "finalizado" }, // Opcional: solo activos
    });
    res.json(rides);
  } catch (err) {
    res.status(500).json({ message: "Error al obtener viajes" });
  }
};
//--------------------------------

exports.getRequest = async (req, res) => {
  try {
    const { passengerId, origin } = req.body;

    if (!passengerId || !origin) {
      return res.status(400).json({ message: "Datos incompletos" });
    }

    const newRide = new Ride({
      passenger: passengerId,
      origin,
    });

    await newRide.save();

    res.status(201).json({
      message: "Solicitud de viaje registrada",
      rideId: newRide._id,
    });
  } catch (err) {
    console.error("Error al crear el viaje:", err.message);
    res.status(500).json({ message: "Error del servidor" });
  }
};
