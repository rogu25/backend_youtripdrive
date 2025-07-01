const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const {
  createRide,
  getAvailableRides,
  acceptRide,
  updateRideStatus,
  getMyRides,
  getActiveRide,
  getRidesById
} = require("../controllers/ride.controller");

router.post("/", auth, createRide);                     // Crear viaje (pasajero)
router.get("/available", auth, getAvailableRides);      // Ver viajes disponibles (conductor)
router.put("/accept/:rideId", auth, acceptRide);        // Aceptar viaje (conductor)
router.put("/status/:rideId", auth, updateRideStatus);  // Actualizar estado del viaje
router.get("/my", auth, getMyRides);                    // Mostrar viajes del usuario
router.get("/active", auth, getActiveRide);             // Obtener viaje activo
router.get("/getRidesById/:rideId", auth, getRidesById);      // Obtener viaje por ID

module.exports = router;
