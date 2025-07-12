// backend/models/Driver.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DriverSchema = new Schema({
    // Campos de autenticación y perfil del conductor
    userId: { // Referencia al ID del usuario si tienes un modelo de Usuario genérico
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // Asumiendo que tienes un modelo 'User' para autenticación
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: { // Si el email no está en User, ponlo aquí
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        unique: true,
        sparse: true // Permite que haya múltiples documentos con 'null' si no es requerido
    },

    // Detalles del vehículo
    carDetails: {
        model: { type: String, trim: true },
        licensePlate: { type: String, unique: true, trim: true },
        color: { type: String, trim: true }
    },

    // Ubicación actual del conductor
    currentLocation: {
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null }
    },

    // Estado de disponibilidad del conductor
    isAvailable: {
        type: Boolean,
        default: false
    },

    // Otros campos específicos del conductor (ej. rating, documentos, etc.)
    rating: {
        type: Number,
        min: 0,
        max: 5,
        default: 5
    },
    // ... otros campos que necesites ...

}, {
    timestamps: true // Añade createdAt y updatedAt
});

module.exports = mongoose.model('Driver', DriverSchema);