// models/Location.js
const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  coordinates: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Location", locationSchema);
