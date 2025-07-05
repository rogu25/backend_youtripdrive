const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // <-- MUY IMPORTANTE: Asegura que cada usuario tenga solo un registro de ubicación actual
      sparse: true, // <-- Útil si el campo 'user' no siempre existiera (aunque aquí es 'required')
    },
    coordinates: {
      // Consistencia con los nombres de los campos en el controlador y las rutas.
      // En tu controlador y rutas, usábamos 'latitude' y 'longitude'.
      // Aquí tienes 'lat' y 'lng'. Deben ser consistentes.
      latitude: { type: Number, required: true }, // <-- CAMBIADO de 'lat'
      longitude: { type: Number, required: true }, // <-- CAMBIADO de 'lng'
    },
  },
  { timestamps: true } // Esto es excelente para 'createdAt' y 'updatedAt'
);

module.exports = mongoose.model("Location", locationSchema);