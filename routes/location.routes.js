const express = require("express");
const router = express.Router();
const Location = require("../models/Location");
const authMiddleware = require("../middlewares/auth.middleware");
const driverLocation = require("../controllers/location.controller");

// Obtener conductores disponibles
router.get("/available",  async (req, res) => {
  try {
    const drivers = await Location.find().populate("user", "name");
    res.json(drivers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al obtener conductores." });
  }
});

// Actualizar o guardar ubicación del conductor
router.post("/update", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { lat, lng } = req.body;

    if (!userId) {
      return res.status(401).json({ msg: "Usuario no autenticado" });
    }

    if (typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({ msg: "Latitud y longitud requeridas y válidas" });
    }

    let location = await Location.findOne({ user: userId });

    if (location) {
      location.coordinates = { lat, lng };
      location.updatedAt = Date.now();
      await location.save();
    } else {
      location = new Location({
        user: userId,
        coordinates: { lat, lng },
      });
      await location.save();
    }

    res.status(200).json({ msg: "Ubicación actualizada correctamente" });
  } catch (err) {
    console.error("Error interno al actualizar ubicación:", err);
    res.status(500).json({ msg: "Error al actualizar ubicación." });
  }
});


// GET /api/location/:driverId
router.get("/:driverId",  driverLocation.getDriverLocation);


module.exports = router;
