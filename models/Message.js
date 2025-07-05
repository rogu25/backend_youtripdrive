// models/Message.js
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride", // Referencia al modelo de Viaje
      required: true,
      // Opcional: index: true para mejorar el rendimiento de búsqueda por rideId si hay muchos mensajes por viaje
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Referencia al modelo de Usuario (el que envió el mensaje)
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true, // Elimina espacios en blanco al inicio y al final del contenido del mensaje
      // Opcional: maxLength: 500 (o el límite que consideres) para mensajes muy largos
    },
    // Nota: El 'receiver' (el otro participante del chat) no está explícitamente aquí,
    // se infiere del 'rideId' y del 'sender'. Esto es una buena decisión de diseño
    // si el chat es siempre entre los dos participantes del viaje.
  },
  {
    timestamps: true, // Añade automáticamente 'createdAt' y 'updatedAt'
  }
);

module.exports = mongoose.model("Message", messageSchema);