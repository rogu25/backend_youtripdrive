const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: {
    type: String,
    enum: ["pasajero", "conductor"],
    default: "pasajero",
  },
  driverInfo: {
    dni: String,
    license: String,
    vehicle: {
      brand: String,
      model: String,
      color: String,
      year: String,
    },
  },
  currentLocation: {
    latitude: Number,
    longitude: Number
  },
  
});



// Encriptar password antes de guardar
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

module.exports = mongoose.model("User", userSchema);
