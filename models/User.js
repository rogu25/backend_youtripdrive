const mongoose = require("mongoose");
// Usa 'bcryptjs' para consistencia con el controlador si es el que tienes instalado.
// Si instalaste solo 'bcrypt', asegúrate de que sea la versión compatible con Node.js.
// Lo más común en Node.js es usar 'bcryptjs'.
const bcrypt = require("bcryptjs"); // Cambiado a bcryptjs para consistencia si no lo es ya.

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true, // El nombre es obligatorio
    trim: true, // Eliminar espacios en blanco al inicio y final
  },
  email: {
    type: String,
    required: true, // El email es obligatorio
    unique: true, // Asegura que el email sea único
    lowercase: true, // Guarda el email en minúsculas para consistencia
    trim: true,
  },
  password: {
    type: String,
    required: true, // La contraseña es obligatoria
    // select: false, // <-- MUY IMPORTANTE: No devolver la contraseña en las consultas por defecto
  },
  role: {
    type: String,
    enum: ["pasajero", "conductor"],
    default: "pasajero",
    required: true, // El rol es obligatorio
  },
  driverInfo: {
    // Si el usuario no es un conductor, este objeto debería ser null o no existir.
    // Usar 'type: Object' o definir sub-esquemas si quieres validaciones más finas.
    // Puedes hacerlo opcional con 'required: false' o simplemente no incluirlo.
    dni: {
      type: String,
      // Puedes añadir 'unique: true' si el DNI debe ser único.
      // Puedes añadir 'sparse: true' si usas 'unique' en un campo que no siempre existe.
    },
    license: {
      type: String,
      // unique: true, sparse: true
    },
    vehicle: {
      brand: String,
      model: String,
      color: String,
      year: {
        type: Number, // <--- CAMBIADO: De String a Number para consistencia
      },
    },
  },
  currentLocation: {
    latitude: Number,
    longitude: Number,
    // Puedes añadir default: null o un objeto vacío si no siempre habrá ubicación.
  },
  createdAt: {
    type: Date,
    default: Date.now, // Añadir fecha de creación automáticamente
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true, // Esto añade automáticamente createdAt y updatedAt
  // Puedes eliminar createdAt y updatedAt manual si usas timestamps: true
});


// !!! MUY IMPORTANTE: ELIMINAR EL HOOK pre('save') PARA HASHEAR LA CONTRASEÑA AQUÍ.
// Ya estamos hasheando la contraseña en auth.controller.js.
// Tenerlo en ambos lugares causaría un doble hasheo o un error.
/*
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});
*/

module.exports = mongoose.model("User", userSchema);