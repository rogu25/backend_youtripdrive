const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware"); // Middleware de autenticación

// Importa todas las funciones del controlador de viajes
const {
  createRide,
  getAvailableRides,
  acceptRide,
  updateRideStatus,
  getMyRides,
  getActiveRide,
  getRideById,
  cancelRide // <-- Renombrado para coincidir con el controlador
  // requestRide // <-- COMENTADO/ELIMINADO: Duplicado con createRide
} = require("../controllers/ride.controller");

// 1. POST /api/rides/ - Crear viaje (pasajero)
router.post("/", auth, createRide);

// 2. GET /api/rides/available - Ver viajes disponibles (conductor)
router.get("/available", auth, getAvailableRides);

// 3. PUT /api/rides/accept/:rideId - Aceptar viaje (conductor)
router.put("/accept/:rideId", auth, acceptRide);

// 4. PUT /api/rides/status/:rideId - Actualizar estado del viaje (pasajero o conductor)
router.put("/status/:rideId", auth, updateRideStatus);

// 5. GET /api/rides/my - Mostrar viajes del usuario (pasajero o conductor)
router.get("/my", auth, getMyRides);

// 6. GET /api/rides/active - Obtener viaje activo (pasajero o conductor)
router.get("/active", auth, getActiveRide);

// 7. GET /api/rides/:rideId - Obtener viaje por ID
// CONSISTENCIA: Renombrado de '/getRidesById/:rideId' a '/:rideId'
// Esto sigue un patrón RESTful más común y elimina la redundancia en la URL.
router.get("/:rideId", auth, getRideById); // <-- Usando el nombre corregido del controlador

// 8. POST para eliminar o cancelar un viaje
router.post('/:id/cancel', auth, cancelRide)

module.exports = router;