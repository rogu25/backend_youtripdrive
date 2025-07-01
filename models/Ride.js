const mongoose = require("mongoose");

const rideSchema = new mongoose.Schema({
  passenger: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  origin: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  destination: {
    lat: Number,
    lng: Number,
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  status: {
    type: String,
    enum: ["buscando", "aceptado", "en_curso", "finalizado", "cancelado"],
    default: "buscando",
  },
  price_offered: {
    type: Number,
  },
  price_accepted: {
    type: Number,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Ride", rideSchema);
