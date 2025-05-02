const Message = require("../models/Message");

const Ride = require("../models/Ride");


function socketHandler(socket, io) {
  console.log("Cliente conectado:", socket.id);

  // Unirse a sala privada de usuario
  socket.on("join", (userId) => {
    socket.join(userId);
  });

  // Unirse a sala de viaje
  socket.on("join_ride_chat", (rideId) => {
    socket.join(`ride_${rideId}`);
    console.log(`Socket ${socket.id} se unió a la sala del viaje ${rideId}`);
  });

  // Recibir y reenviar mensajes
  socket.on("send_message", async ({ rideId, senderId, content }) => {
    if (!rideId || !senderId || !content) return;
  
    const ride = await Ride.findById(rideId);
    if (!ride) return;
  
    const isAllowed =
      ride.passenger.toString() === senderId || ride.driver?.toString() === senderId;
  
    if (!isAllowed) return; // No permitir envío
  
    const msg = new Message({ ride: rideId, sender: senderId, content });
    await msg.save();
  
    io.to(`ride_${rideId}`).emit("receive_message", {
      _id: msg._id,
      ride: msg.ride,
      sender: msg.sender,
      content: msg.content,
      createdAt: msg.createdAt,
    });
  });

  socket.on("typing", ({ rideId, senderId }) => {
    socket.to(`ride_${rideId}`).emit("user_typing", { senderId });
  });
  

  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
  });

}

module.exports = { socketHandler };
