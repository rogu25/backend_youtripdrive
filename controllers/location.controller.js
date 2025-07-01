const Location = require("../models/Location");

// user.controller.js
exports.updateLocation = async (req, res) => {
  const userId = req.userId; // sacado del token
  console.log("que me llega aqui: ", userId)
  const { lat, lng } = req.body;

  console.log("que me llega BODY: ", req.body)

  try {
    await User.findByIdAndUpdate(userId, { location: { lat, lng } });
    res.status(200).json({ message: "Ubicación actualizada" });
  } catch (err) {
    res.status(500).json({ message: "Error al actualizar ubicación" });
  }
};

exports.getDriverLocation = async (req, res) => {
  const { driverId } = req.params;
  const location = await Location.findOne({ driverId }).sort({ updatedAt: -1 });
  if (!location) return res.status(404).json({ message: "No hay ubicación aún" });
  res.json(location);
};
