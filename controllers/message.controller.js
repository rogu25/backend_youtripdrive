const Message = require("../models/Message");
const Ride = require("../models/Ride");

exports.getRideMessages = async (req, res) => {
  try {
    const { rideId } = req.params;

    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ message: "Viaje no encontrado" });

    const userId = req.userId;
    const isAuthorized =
      ride.passenger.toString() === userId || ride.driver?.toString() === userId;

    if (!isAuthorized) {
      return res.status(403).json({ message: "No autorizado para ver mensajes" });
    }

    const messages = await Message.find({ ride: rideId }).populate("sender", "name");
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Error al obtener mensajes", error: err.message });
  }
};
