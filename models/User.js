// backend/models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs"); // Usar bcryptjs

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // <-- IMPORTANTE: No devolver la contraseña por defecto en las consultas
    },
    role: {
      type: String,
      enum: ["pasajero", "conductor"],
      default: "pasajero",
      required: true,
    },
    // isAvailable: { // Si solo los conductores tienen esta propiedad, es mejor manejarla en el modelo Driver
    //   type: Boolean,
    //   default: false,
    // },
    // driverInfo: { // <-- ELIMINAR ESTO, ya está en Driver.js
    //   // ...
    // },
    // currentLocation: { // <-- ELIMINAR ESTO, ya está en Driver.js
    //   latitude: Number,
    //   longitude: Number,
    // },
  },
  {
    timestamps: true, // Esto añade automáticamente createdAt y updatedAt
  }
);

// MANTENER solo si NO hasheas en el controlador (Auth.controller.js)
// userSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) return next();
//   this.password = await bcrypt.hash(this.password, 10);
//   next();
// });

module.exports = mongoose.model("User", userSchema);