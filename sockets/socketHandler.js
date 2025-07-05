// backend/sockets/socketHandler.js
const Message = require("../models/Message"); // Importa tu modelo de Mensaje

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("🔌 Nuevo cliente conectado");

    socket.on("join", (userId) => {
      socket.join(userId);
      console.log(`Usuario ${userId} se unió a su sala personal.`);
    });

    socket.on("join_ride_chat", (rideId) => {
      socket.join(`ride_${rideId}`);
      console.log(`Cliente se unió al chat del viaje: ride_${rideId}`);
    });

    socket.on("send_message", async (msg) => {
      try {
        const { rideId, senderId, content } = msg;

        // Validación básica de los datos del mensaje
        if (!rideId || !senderId || !content) {
          console.error("❌ Mensaje incompleto recibido:", msg);
          socket.emit("message_error", {
            message: "Datos de mensaje incompletos. Se requieren rideId, senderId y content.",
          });
          return;
        }

        const newMessage = new Message({ rideId, sender: senderId, content });
        await newMessage.save();

        // Popula el remitente para incluir el nombre en el mensaje enviado
        const populatedMsg = await newMessage.populate("sender", "name");

        // Emite el mensaje a todos los clientes en la sala del viaje
        io.to(`ride_${rideId}`).emit("receive_message", populatedMsg);
      } catch (err) {
        console.error("❌ Error al guardar o emitir mensaje:", err.message);
        socket.emit("message_error", {
          message: "Error interno al enviar mensaje.",
          details: err.message,
        });
      }
    });

    socket.on("typing", ({ rideId, senderId }) => {
      // Emite la notificación de "escribiendo" a todos en la sala excepto al que la envió
      socket.to(`ride_${rideId}`).emit("user_typing", { senderId });
    });

    socket.on("disconnect", () => {
      console.log("🔌 Cliente desconectado");
    });
  });
};