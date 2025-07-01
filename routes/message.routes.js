// routes/message.routes.js
const express = require("express");
const router = express.Router();
const {
  getMessagesByRide,
  sendMessage,
} = require("../controllers/message.controller");
const authMiddleware = require("../middlewares/auth.middleware.js")

// Obtener mensajes por ride (requiere autenticación)
router.get("/:rideId", authMiddleware, getMessagesByRide);

// Enviar mensaje por HTTP (opcional, puedes usar solo sockets si prefieres)
router.post("/:rideId", authMiddleware, sendMessage);

module.exports = router;
