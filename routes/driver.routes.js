// backend/routes/driverRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const driverController = require('../controllers/driver.controller'); // Necesitarás crear este

// Ruta para actualizar la disponibilidad del conductor
// Se recomienda PUT o PATCH para actualizar un estado de un recurso existente
router.put('/:id/availability', auth, driverController.updateDriverAvailability);

// Ruta para OBTENER la disponibilidad actual del conductor
router.get('/:id/availability', auth, driverController.getDriverAvailability);

module.exports = router;