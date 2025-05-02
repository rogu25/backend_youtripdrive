const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  ride: { type: mongoose.Schema.Types.ObjectId, ref: "Ride", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model("Message", MessageSchema);
