// routes/message.routes.js
const express = require("express");
const router = express.Router();
const {
  getMessagesByRide,
  sendMessage,
} = require("../controllers/message.controller");
const authMiddleware = require("../middlewares/auth.middleware.js"); // <--- ¡IMPORTANTE! La ruta correcta y el nombre del archivo.

// GET /api/messages/:rideId
router.get("/:rideId", authMiddleware, getMessagesByRide); // <--- Se usa directamente 'authMiddleware'

// POST /api/messages/:rideId
router.post("/:rideId", authMiddleware, sendMessage); // <--- Se usa directamente 'authMiddleware'

module.exports = router;