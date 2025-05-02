const Location = require("../models/Location");

exports.updateLocation = async (req, res) => {
  try {
    const userId = req.userId;
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ msg: "Latitud y longitud son requeridas" });
    }

    // Busca si ya tiene una ubicación registrada
    let location = await Location.findOne({ user: userId });

    if (location) {
      // Actualiza si existe
      location.coordinates = { lat, lng };
      location.updatedAt = Date.now();
      await location.save();
    } else {
      // Crea nueva si no existe
      location = new Location({
        user: userId,
        coordinates: { lat, lng },
      });
      await location.save();
    }

    res.status(200).json({ msg: "Ubicación actualizada correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al actualizar ubicación" });
  }
};
