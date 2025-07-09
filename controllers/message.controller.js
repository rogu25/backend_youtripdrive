// controllers/message.controller.js
const Message = require("../models/Message");
const Ride = require("../models/Ride");
const User = require("../models/User");
const mongoose = require("mongoose"); // ✅ IMPORTAR mongoose

// 1. Obtener mensajes de un viaje
const getMessagesByRide = async (req, res) => {
  console.log("no lo puedo creer: ")
  try {
    const { rideId } = req.params;
    
    // Asumo que tu middleware de auth adjunta el objeto User completo a req.user.
    // Confirmamos: req.user._id para obtener el ID del usuario autenticado.
    const userId = req.user._id.toString();

    // Validación de rideId (MongoDB CastError)
    if (!mongoose.Types.ObjectId.isValid(rideId)) {
      return res.status(400).json({ message: "ID de viaje inválido." });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: "Viaje no encontrado." });
    }

    // AUTORIZACIÓN: Solo los participantes del viaje (pasajero o conductor) pueden ver los mensajes
    const isParticipant =
      (ride.passenger && ride.passenger.toString() === userId) ||
      (ride.driver && ride.driver.toString() === userId);

    if (!isParticipant) {
      console.warn(`Intento de acceso no autorizado a chat del viaje ${rideId} por usuario ${userId}`);
      return res.status(403).json({ message: "No autorizado para ver los mensajes de este viaje." });
    }

    // ✅ CORRECCIÓN FINAL: La consulta debe ser al campo 'rideId' en el modelo Message
    const messages = await Message.find({ rideId: rideId }) // Usar 'rideId' como en tu modelo
      .populate("sender", "name role") // Poblar nombre y rol del remitente
      .sort({ createdAt: 1 }); // Ordenar por fecha de creación ascendente

    res.status(200).json(messages);
  } catch (error) {
    console.error("❌ Error al obtener mensajes:", error.message);
    if (error.name === "CastError") {
      return res.status(400).json({ message: "ID de viaje inválido." });
    }
    res.status(500).json({ message: "Error interno del servidor al obtener mensajes." });
  }
};

// 2. Enviar nuevo mensaje
const sendMessage = async (req, res) => {
  try {
    const { rideId } = req.params;
    const senderId = req.user._id.toString(); // Confirmamos: req.user._id para el ID del remitente
    const { content } = req.body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return res.status(400).json({ message: "El contenido del mensaje no puede estar vacío." });
    }
    if (!mongoose.Types.ObjectId.isValid(rideId)) {
      return res.status(400).json({ message: "ID de viaje inválido." });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: "Viaje no encontrado." });
    }

    // AUTORIZACIÓN: Solo los participantes del viaje pueden enviar mensajes
    const isParticipant =
      (ride.passenger && ride.passenger.toString() === senderId) ||
      (ride.driver && ride.driver.toString() === senderId);

    if (!isParticipant) {
      return res.status(403).json({ message: "No autorizado para enviar mensajes en este viaje." });
    }

    if (['finalizado', 'cancelado'].includes(ride.status)) {
      return res.status(400).json({ message: "No se pueden enviar mensajes en viajes finalizados o cancelados." });
    }

    // ✅ CORRECCIÓN FINAL: El campo en el modelo Message debe ser 'rideId' al crear
    const newMessage = new Message({ rideId: rideId, sender: senderId, content: content.trim() });
    await newMessage.save();

    const populatedMsg = await Message.findById(newMessage._id).populate("sender", "name role");

    // EMITIR MENSAJE VIA SOCKET.IO
    const io = req.app.get("io");
    if (io) {
      // Emitir a la sala específica del viaje (si el cliente se une a 'ride_<rideId>')
      io.to(`ride_${rideId}`).emit("new_message", populatedMsg);
      console.log(`📡 Emitting new_message to ride_${rideId}`);

      // También puedes emitir a las salas personales de los involucrados para mayor redundancia
      // Esto es útil si los usuarios no están necesariamente en la sala del viaje pero sí en su sala personal
      if (ride.passenger) io.to(ride.passenger.toString()).emit("new_message", populatedMsg);
      if (ride.driver) io.to(ride.driver.toString()).emit("new_message", populatedMsg);
      console.log(`📡 Emitting new_message for ride: ${rideId} to passenger: ${ride.passenger?.toString()} and driver: ${ride.driver?.toString()}`);
    }

    res.status(201).json({ message: "Mensaje enviado exitosamente.", message: populatedMsg });
  } catch (error) {
    console.error("❌ Error al enviar mensaje:", error.message);
    if (error.name === "CastError") {
      return res.status(400).json({ message: "ID de viaje inválido." });
    }
    res.status(500).json({ message: "Error interno del servidor al enviar el mensaje." });
  }
};

module.exports = {
  getMessagesByRide,
  sendMessage,
};