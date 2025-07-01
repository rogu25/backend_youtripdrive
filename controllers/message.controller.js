// controllers/message.controller.js
const Message = require("../models/Message");
const Ride = require("../models/Ride");

// Obtener mensajes de un viaje
const getMessagesByRide = async (req, res) => {
  try {
    const { rideId } = req.params;

    const rideExists = await Ride.findById(rideId);
    if (!rideExists) {
      return res.status(404).json({ message: "Viaje no encontrado" });
    }

    const messages = await Message.find({ rideId })
      .populate("sender", "name role")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    console.error("Error al obtener mensajes:", error);
    res.status(500).json({ message: "Error del servidor" });
  }
};

// Enviar nuevo mensaje (opcional si quieres vía REST además de socket)
const sendMessage = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { senderId, content } = req.body;

    const newMessage = new Message({ rideId, sender: senderId, content });
    await newMessage.save();

    const populatedMsg = await newMessage.populate("sender", "name");

    res.status(201).json(populatedMsg);
  } catch (error) {
    console.error("Error al enviar mensaje:", error);
    res.status(500).json({ message: "Error del servidor" });
  }
};

module.exports = {
  getMessagesByRide,
  sendMessage,
};
