const mongoose = require("mongoose");

const RideSchema = new mongoose.Schema({
  passenger: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  origin: {
    lat: Number,
    lng: Number,
  },
  destination: {
    lat: Number,
    lng: Number,
  },
  price_offered: Number,
  price_accepted: Number,
  status: {
    type: String,
    enum: ["requested", "accepted", "in_progress", "completed", "cancelled"],
    default: "requested",
  },
}, { timestamps: true });

module.exports = mongoose.model("Ride", RideSchema);
