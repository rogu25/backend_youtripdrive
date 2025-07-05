// controllers/message.controller.js
const Message = require("../models/Message");
const Ride = require("../models/Ride");
const User = require("../models/User"); // Necesario para poblar el sender con rol completo si es necesario

// 1. Obtener mensajes de un viaje
const getMessagesByRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.userId; // ID del usuario autenticado del token

    // Validación de rideId (MongoDB CastError)
    if (!mongoose.Types.ObjectId.isValid(rideId)) { // Asumiendo que mongoose está importado
      return res.status(400).json({ message: "ID de viaje inválido." });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: "Viaje no encontrado." });
    }

    // AUTORIZACIÓN: Solo los participantes del viaje (pasajero o conductor) pueden ver los mensajes
    const isParticipant = ride.passenger.toString() === userId || ride.driver?.toString() === userId;
    if (!isParticipant) {
      return res.status(403).json({ message: "No autorizado para ver los mensajes de este viaje." });
    }

    // Opcional: Solo permitir ver mensajes para viajes con estados activos (o todos si es historial)
    // if (['finalizado', 'cancelado'].includes(ride.status)) {
    //   // Puedes permitir ver el historial o denegar si el chat está cerrado
    //   // return res.status(403).json({ message: "No se pueden ver mensajes de viajes finalizados o cancelados." });
    // }


    const messages = await Message.find({ rideId })
      .populate("sender", "name role") // Poblar nombre y rol del remitente
      .sort({ createdAt: 1 }); // Ordenar por fecha de creación ascendente

    res.status(200).json(messages); // Siempre devolver 200 OK en éxito
  } catch (error) {
    console.error("❌ Error al obtener mensajes:", error.message);
    // Manejar CastError si el ID no es válido para MongoDB
    if (error.name === 'CastError') {
      return res.status(400).json({ message: "ID de viaje inválido." });
    }
    res.status(500).json({ message: "Error interno del servidor al obtener mensajes." });
  }
};

// 2. Enviar nuevo mensaje (vía REST, si decides usar esta ruta además de Socket.IO)
// RECOMENDACIÓN: Prioriza el envío de mensajes por Socket.IO para chat en tiempo real.
// Esta ruta REST puede ser un fallback o para un caso de uso específico.
const sendMessage = async (req, res) => {
  try {
    const { rideId } = req.params;
    // IMPORTANTE: El senderId SIEMPRE debe venir del token del usuario autenticado (req.userId), NO del body.
    const senderId = req.userId;
    const { content } = req.body;

    // Validación de campos
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ message: "El contenido del mensaje no puede estar vacío." });
    }
    // Validación de rideId (MongoDB CastError)
    if (!mongoose.Types.ObjectId.isValid(rideId)) {
      return res.status(400).json({ message: "ID de viaje inválido." });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: "Viaje no encontrado." });
    }

    // AUTORIZACIÓN: Solo los participantes del viaje pueden enviar mensajes
    const isParticipant = ride.passenger.toString() === senderId || ride.driver?.toString() === senderId;
    if (!isParticipant) {
      return res.status(403).json({ message: "No autorizado para enviar mensajes en este viaje." });
    }

    // Opcional: Solo permitir enviar mensajes si el viaje está en un estado 'activo' de chat
    if (['finalizado', 'cancelado'].includes(ride.status)) {
      return res.status(400).json({ message: "No se pueden enviar mensajes en viajes finalizados o cancelados." });
    }

    const newMessage = new Message({ rideId, sender: senderId, content: content.trim() });
    await newMessage.save();

    // Poblar el mensaje para la respuesta y para la emisión de Socket.IO
    const populatedMsg = await Message.findById(newMessage._id).populate("sender", "name role");

    // EMITIR MENSAJE VIA SOCKET.IO para tiempo real
    const io = req.app.get("io");
    if (io) {
      // Identificar al receptor (el otro participante del viaje)
      let receiverId = null;
      if (ride.passenger.toString() === senderId) {
        receiverId = ride.driver?.toString(); // Si el sender es el pasajero, el receiver es el driver
      } else {
        receiverId = ride.passenger.toString(); // Si el sender es el driver, el receiver es el pasajero
      }

      // Emitir el mensaje a la sala específica del viaje (si tienes una sala de chat por rideId)
      io.to(`ride_${rideId}`).emit("new_message", populatedMsg);
      console.log(`📡 Emitting new_message to ride_${rideId}`);

      // También podrías emitir solo a las salas personales de los involucrados (pasajero y conductor)
      if (ride.passenger) io.to(ride.passenger.toString()).emit("new_message", populatedMsg);
      if (ride.driver) io.to(ride.driver.toString()).emit("new_message", populatedMsg);
      console.log(`📡 Emitting new_message to sender (${senderId}) and receiver (${receiverId}) for ride: ${rideId}`);
    }

    res.status(201).json({ message: "Mensaje enviado exitosamente.", message: populatedMsg });
  } catch (error) {
    console.error("❌ Error al enviar mensaje:", error.message);
    // Manejar CastError si el ID no es válido para MongoDB
    if (error.name === 'CastError') {
      return res.status(400).json({ message: "ID de viaje inválido." });
    }
    res.status(500).json({ message: "Error interno del servidor al enviar el mensaje." });
  }
};

module.exports = {
  getMessagesByRide,
  sendMessage,
};