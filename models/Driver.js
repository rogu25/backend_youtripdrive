// backend/models/Driver.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DriverSchema = new Schema({
    // Campos de autenticación y perfil del conductor
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        unique: true,
        sparse: true
    },

    // Detalles del vehículo - Hacemos estos subcampos REQUIRED
    carDetails: {
        model: { type: String, required: true, trim: true }, // <-- AHORA REQUIRED
        licensePlate: { type: String, required: true, unique: true, trim: true }, // <-- AHORA REQUIRED
        color: { type: String, required: true, trim: true } // <-- AHORA REQUIRED
    },

    // Ubicación actual del conductor - Establecemos a empty object por defecto, no null, si queremos que los subcampos existan
    // O si siempre esperas lat/lng, hazlos required también
    currentLocation: {
        latitude: { type: Number }, // <-- Eliminar default: null para que si existe en DB se pueble, si no, sea undefined
        longitude: { type: Number } // <-- Eliminar default: null
        // Considera hacerlos 'required: true' si siempre deben existir
    },

    isAvailable: {
        type: Boolean,
        default: false
    },

    rating: {
        type: Number,
        min: 0,
        max: 5,
        default: 5
    },

}, {
    timestamps: true
});

module.exports = mongoose.model('Driver', DriverSchema);