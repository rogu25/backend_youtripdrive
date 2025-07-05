// routes/message.routes.js
const express = require("express");
const router = express.Router();
const {
  getMessagesByRide,
  sendMessage,
} = require("../controllers/message.controller");
const authMiddleware = require("../middlewares/auth.middleware.js"); // Asegúrate de que la ruta sea correcta

// GET /api/messages/:rideId - Obtener todos los mensajes de un viaje específico
// Requiere autenticación para asegurar que solo los usuarios autorizados accedan a los mensajes de un viaje.
router.get("/:rideId", authMiddleware, getMessagesByRide);

// POST /api/messages/:rideId - Enviar un nuevo mensaje a un viaje específico
// Aunque el chat en tiempo real se maneja principalmente con Sockets, esta ruta REST
// puede ser útil como un fallback o para integración con otros sistemas.
// Requiere autenticación para validar al remitente del mensaje.
router.post("/:rideId", authMiddleware, sendMessage);

module.exports = router;