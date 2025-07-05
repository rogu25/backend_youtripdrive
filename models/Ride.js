const mongoose = require("mongoose");

const rideSchema = new mongoose.Schema({
  passenger: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  origin: {
    // Consistencia en los nombres de los campos (latitude, longitude)
    latitude: { type: Number, required: true }, // <-- CAMBIADO de 'lat'
    longitude: { type: Number, required: true }, // <-- CAMBIADO de 'lng'
    address: { type: String, trim: true }, // Opcional: Añadir un campo para la dirección legible
  },
  destination: {
    // Consistencia en los nombres de los campos (latitude, longitude)
    latitude: { type: Number, required: true }, // <-- Añadido required: true (el destino es fundamental)
    longitude: { type: Number, required: true }, // <-- Añadido required: true
    address: { type: String, trim: true }, // Opcional: Añadir un campo para la dirección legible
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null, // Si el viaje aún no tiene un conductor asignado.
    // Opcional: Puedes añadir un campo para el momento en que se asignó el conductor, si es relevante.
    // assignedAt: { type: Date }
  },
  status: {
    type: String,
    enum: ["buscando", "aceptado", "en_curso", "finalizado", "cancelado"],
    default: "buscando",
    required: true, // El estado es un campo fundamental y debe ser requerido
  },
  price_offered: {
    type: Number,
    min: 0, // El precio ofrecido no puede ser negativo
    required: true, // El precio ofrecido es crucial para el modelo de negocio
  },
  price_accepted: {
    type: Number,
    min: 0, // El precio aceptado no puede ser negativo
    // Este campo no es requerido al inicio, ya que se establece cuando un conductor acepta.
  },
  // Opcionales para mejor seguimiento y flexibilidad:
  rejectedDrivers: [ // Array para almacenar IDs de conductores que han rechazado el viaje
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  acceptedDrivers: [ // Array para almacenar IDs de conductores que han aceptado el viaje (si es un modelo de múltiples ofertas)
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      price: Number, // Precio específico aceptado por ese conductor
      acceptedAt: Date, // Momento de la aceptación
    },
  ],
  // duration: Number, // Duración estimada o real del viaje en minutos
  // distance: Number, // Distancia estimada o real del viaje en kilómetros/metros

}, {
  timestamps: true // Esto añade automáticamente createdAt y updatedAt. Puedes eliminar tu createdAt manual.
});

module.exports = mongoose.model("Ride", rideSchema);