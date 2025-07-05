// routes/location.routes.js

const express = require("express");
const router = express.Router();
// Importa el modelo User para el populate, es necesario aquí
const User = require("../models/User"); // ¡Asegúrate de que este import esté activo!
const Location = require("../models/Location");
const authMiddleware = require("../middlewares/auth.middleware");

// Importa las funciones específicas del controlador
const { 
  updateCurrentLocation, 
  getDriverCurrentLocation 
} = require("../controllers/location.controller");

// RUTA CORREGIDA: 1. Obtener conductores disponibles (para el mapa del pasajero)
// Esta ruta es la que tu PassengerHomeScreen.js llama con /api/location/available
router.get("/available", async (req, res) => {
    try {
        // Encontrar todos los registros de ubicación.
        // Usamos populate para traer la información del usuario asociado a la ubicación.
        // Solo traemos usuarios que tienen el rol 'conductor'.
        const driverLocations = await Location.find()
            .populate({
                path: "user",
                select: "name role", // Selecciona solo el nombre y el rol del usuario
                match: { role: "conductor" } // Filtra para que solo nos dé usuarios con rol 'conductor'
            });

        const availableDriversData = [];
        for (const loc of driverLocations) {
            // Es crucial que 'loc.user' no sea null (porque 'match' puede hacer que el populate devuelva null si no coincide)
            // Y que las coordenadas existan y sean números válidos.
            if (loc.user && loc.user.role === 'conductor' && loc.coordinates &&
                typeof loc.coordinates.latitude === 'number' && typeof loc.coordinates.longitude === 'number') {

                availableDriversData.push({
                    _id: loc.user._id, // EL ID DEL USUARIO ES LO QUE EL FRONTEND ESPERA PARA LA KEY DEL MARKER
                    name: loc.user.name,
                    coordinates: {
                        latitude: loc.coordinates.latitude,
                        longitude: loc.coordinates.longitude,
                    },
                    lastUpdated: loc.updatedAt,
                });
            }
        }

        res.status(200).json(availableDriversData);
    } catch (err) {
        console.error("❌ Error al obtener ubicaciones de conductores disponibles:", err);
        res.status(500).json({ message: "Error interno del servidor al obtener conductores disponibles." });
    }
});


// 2. Actualizar o guardar ubicación del usuario (principalmente conductor)
router.post("/update", authMiddleware, updateCurrentLocation);


// 3. Obtener la ubicación de un conductor específico
router.get("/:driverId", getDriverCurrentLocation);


module.exports = router;