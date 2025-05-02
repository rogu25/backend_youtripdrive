const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const {
  createRide,
  getAvailableRides,
  acceptRide,
  updateRideStatus,
  getMyRides,
} = require("../controllers/ride.controller");

// ...

router.post("/", auth, createRide);                      // Crear viaje (pasajero)
router.get("/available", auth, getAvailableRides);       // Ver viajes disponibles (conductor)
router.post("/:rideId/accept", auth, acceptRide);        // Aceptar viaje (conductor)
router.put("/:rideId/status", auth, updateRideStatus);  // Actualizar estado del viaje
router.get("/my", auth, getMyRides); // mostrar viajes activos

module.exports = router;
