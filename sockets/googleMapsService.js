// backend/utils/googleMapsService.js
const axios = require('axios');

// Asegúrate de que tu API Key de Google Maps esté disponible en tus variables de entorno.
// Configura `dotenv` en tu archivo principal de la app (e.g., server.js o app.js) al inicio.
const Maps_API_KEY = process.env.Maps_API_KEY; 

/**
 * Calcula el ETA (tiempo estimado de llegada) entre dos puntos usando Google Directions API.
 * @param {object} origin - { latitude, longitude } del punto de origen.
 * @param {object} destination - { latitude, longitude } del punto de destino.
 * @returns {Promise<number|null>} - ETA en segundos o null si hay un error.
 */
async function calculateEta(origin, destination) {
    if (!Maps_API_KEY) {
        console.error("ERROR: Maps_API_KEY no está configurada en las variables de entorno.");
        return null; 
    }

    if (!origin || !destination || !origin.latitude || !origin.longitude || !destination.latitude || !destination.longitude) {
        console.error("ERROR: Origen o destino inválido para el cálculo de ETA.");
        return null;
    }

    const originStr = `${origin.latitude},${origin.longitude}`;
    const destinationStr = `${destination.latitude},${destination.longitude}`;

    // La URL para la Directions API. 'mode=driving' es para vehículos.
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destinationStr}&mode=driving&key=${Maps_API_KEY}`;

    try {
        console.log(`[GoogleMapsService] Solicitando ETA: ${originStr} -> ${destinationStr}`);
        const response = await axios.get(url);
        const data = response.data;

        if (data.status === 'OK' && data.routes.length > 0) {
            // El ETA se encuentra en legs[0].duration.value (en segundos)
            // Tomamos la duración del primer segmento de la primera ruta.
            const durationInSeconds = data.routes[0].legs[0].duration.value;
            console.log(`[GoogleMapsService] ETA calculado: ${durationInSeconds} segundos.`);
            return durationInSeconds;
        } else if (data.status === 'ZERO_RESULTS') {
            console.warn(`[GoogleMapsService] No se encontró ruta entre ${originStr} y ${destinationStr}.`);
            return null;
        } else {
            console.error(`[GoogleMapsService] Error de Directions API: ${data.error_message || data.status}`);
            return null; 
        }
    } catch (error) {
        console.error('[GoogleMapsService] Error al llamar a Google Directions API:', error.message);
        if (error.response) {
            console.error('[GoogleMapsService] Respuesta de error de API:', error.response.data);
        }
        return null;
    }
}

module.exports = { calculateEta };