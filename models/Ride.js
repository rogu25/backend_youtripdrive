// models/Ride.js
const mongoose = require("mongoose");

const rideSchema = new mongoose.Schema(
  {
    // --- INFORMACIÓN BÁSICA DEL VIAJE ---
    passenger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // Útil para buscar viajes de un pasajero
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // Será null hasta que un conductor acepte
      index: true, // Útil para buscar viajes de un conductor
    },

    // --- UBICACIONES ---
    origin: { // Mantenemos 'origin' como lo tenías
      address: { type: String, required: true, trim: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    destination: { // Mantenemos 'destination' como lo tenías
      address: { type: String, required: true, trim: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },

    // --- ESTADO Y PRECIOS ---
    status: {
      type: String,
      enum: [
        "buscando",  // Pasajero solicitó, buscando conductor
        "aceptado",  // Conductor aceptó, en camino a recoger
        "recogido",  // <--- NUEVO ESTADO: Conductor ha recogido al pasajero, viaje en curso
        "finalizado",// <--- NUEVO ESTADO: Viaje completado con éxito
        "cancelado", // Viaje cancelado por pasajero o conductor 
      ],
      default: "buscando",
      required: true,
    },
    price_offered: { // Mantenemos 'price_offered' como lo tenías
      type: Number,
      required: true,
      min: 0,
    },
    price_accepted: { // Mantenemos 'price_accepted' como lo tenías (se llena al aceptar)
      type: Number,
      min: 0,
    },
    costoFinal: { // <--- NUEVO CAMPO: Costo final real (si se calcula dinámicamente)
      type: Number,
      min: 0,
      default: null, // Será null hasta que el viaje se complete
    },

    // --- TIMESTAMPS DE PROGRESO DEL VIAJE ---
    acceptedAt: { // Momento en que un conductor acepta el viaje
      type: Date,
      default: null,
    },
    pickedUpAt: { // <--- NUEVO CAMPO: Momento en que el conductor marca que ha recogido al pasajero
      type: Date,
      default: null,
    },
    completedAt: { // <--- NUEVO CAMPO: Momento en que el conductor finaliza el viaje
      type: Date,
      default: null,
    },
    cancelledAt: { // Momento en que el viaje se cancela
      type: Date,
      default: null,
    },

    // --- INFORMACIÓN ADICIONAL (Opcional, si la necesitas) ---
    rejectedDrivers: [ // Array para IDs de conductores que han rechazado el viaje
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    acceptedDrivers: [ // Si tu lógica permite múltiples ofertas antes de la selección
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        price: Number,
        acceptedAt: Date,
      },
    ],
    // Puedes añadir campos para distancia y duración si los necesitas para cálculos
    // distanciaEstimada: { type: Number, min: 0, default: 0 },
    // duracionEstimada: { type: Number, min: 0, default: 0 },
  },
  {
    timestamps: true, // Añade automáticamente `createdAt` y `updatedAt`
  }
);

module.exports = mongoose.model("Ride", rideSchema);