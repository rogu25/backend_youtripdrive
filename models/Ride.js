// backend/models/Ride.js
const mongoose = require("mongoose");

const rideSchema = new mongoose.Schema({
  passenger: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  origin: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: { type: String, trim: true },
  },
  destination: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: { type: String, trim: true },
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Driver", // <-- ¡ASEGÚRATE DE QUE ESTÉ ASÍ!
    default: null,
  },
  status: {
    type: String,
    enum: ["buscando", "aceptado", "recogido", "en_ruta", "finalizado", "cancelado"],
    default: "buscando",
    required: true,
  },
  price_offered: {
    type: Number,
    min: 0,
    required: true,
  },
  price_accepted: {
    type: Number,
    min: 0,
  },
  rejectedDrivers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  acceptedDrivers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      price: Number,
      acceptedAt: Date,
    },
  ],
}, {
  timestamps: true,
});

module.exports = mongoose.model("Ride", rideSchema);