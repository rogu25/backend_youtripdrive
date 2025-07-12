// backend/sockets/socketHandler.js (Confirmación de cambios)
const Message = require("../models/Message");
const Driver = require("../models/Driver");
const mongoose = require('mongoose');

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("🔌 Nuevo cliente conectado. ID del socket:", socket.id);

    const userIdFromQuery = socket.handshake.query.userId;
    const role = socket.handshake.query.role;

    if (userIdFromQuery) {
      socket.userId = userIdFromQuery; // Guardar para uso en disconnect
      socket.userRole = role; // Guardar el rol para uso en disconnect
      socket.join(userIdFromQuery);
      console.log(`Usuario ${userIdFromQuery} (${role || 'desconocido'}) se unió a su sala personal.`);
    }

    // El evento 'join' separado puede ser redundante si userIdFromQuery siempre se usa.
    // Si lo mantienes, asegúrate de que también establezca socket.userId y socket.userRole
    socket.on("join", (id) => {
        // Asegúrate de que este 'id' sea el userId del usuario
        socket.join(id);
        socket.userId = id;
        // Podrías intentar inferir el rol o pedirlo en este evento si es necesario
        console.log(`Usuario ${id} se unió a su sala personal (via evento 'join').`);
    });

    socket.on("join_ride_chat", (rideId) => {
      socket.join(`ride_${rideId}`);
      console.log(`Cliente se unió al chat del viaje: ride_${rideId}`);
    });

    socket.on("driverLocationUpdate", async (data) => {
      const { driverId, latitude, longitude, isAvailable } = data; // ¡Recibimos isAvailable!

      try {
        const objectIdOfUser = new mongoose.Types.ObjectId(driverId);

        const updatedDriver = await Driver.findOneAndUpdate(
          { userId: objectIdOfUser },
          {
            $set: {
              'currentLocation.latitude': latitude,
              'currentLocation.longitude': longitude,
            },
            isAvailable: isAvailable, // <-- ¡USA LA DISPONIBILIDAD DEL FRONTEND!
          },
          { new: true, runValidators: true }
        );

        if (updatedDriver) {
          console.log(`✅ Ubicación de conductor ${driverId} (User ID) actualizada en DB. Disponible: ${updatedDriver.isAvailable}`);

          if (updatedDriver.isAvailable) {
            io.emit('driverLocationUpdateForPassengers', {
              driverId: updatedDriver._id.toString(),
              latitude: updatedDriver.currentLocation.latitude,
              longitude: updatedDriver.currentLocation.longitude,
              driverName: updatedDriver.name,
              isAvailable: updatedDriver.isAvailable, // También emite la disponibilidad
            });
          } else {
            // Si el conductor se marcó como NO disponible, notificar a los pasajeros.
            io.emit('driverUnavailable', { driverId: updatedDriver._id.toString() });
            console.log(`🚫 Conductor ${driverId} marcado como NO DISPONIBLE. Emitiendo 'driverUnavailable'.`);
          }
        } else {
          console.warn(`⚠️ Conductor con User ID ${driverId} no encontrado en la base de datos para actualizar.`);
        }
      } catch (error) {
        console.error('❌ Error al actualizar o emitir ubicación de conductor:', error.message);
      }
    });

    socket.on("driverSetUnavailable", async (data) => {
      const { driverId } = data; // driverId aquí es el User's _id
      try {
        const objectIdOfUser = new mongoose.Types.ObjectId(driverId);
        const updatedDriver = await Driver.findOneAndUpdate(
          { userId: objectIdOfUser },
          { isAvailable: false },
          { new: true }
        );

        if (updatedDriver) {
          console.log(`✅ Conductor ${driverId} (User ID) marcado explícitamente como NO DISPONIBLE.`);
          io.emit('driverUnavailable', { driverId: updatedDriver._id.toString() });
        } else {
          console.warn(`⚠️ Conductor con User ID ${driverId} no encontrado para marcar como no disponible.`);
        }
      } catch (error) {
        console.error('❌ Error al marcar conductor como no disponible explícitamente:', error.message);
      }
    });

    socket.on("send_message", async (msg) => {
      try {
        const { rideId, senderId, content } = msg;
        if (!rideId || !senderId || !content) {
          console.error("❌ Mensaje incompleto recibido:", msg);
          socket.emit("message_error", { message: "Datos de mensaje incompletos." });
          return;
        }
        const newMessage = new Message({ rideId, sender: senderId, content });
        await newMessage.save();
        const populatedMsg = await newMessage.populate("sender", "name");
        io.to(`ride_${rideId}`).emit("receive_message", populatedMsg);
      } catch (err) {
        console.error("❌ Error al guardar o emitir mensaje:", err.message);
        socket.emit("message_error", { message: "Error interno al enviar mensaje.", details: err.message });
      }
    });

    socket.on("typing", ({ rideId, senderId }) => {
      socket.to(`ride_${rideId}`).emit("user_typing", { senderId });
    });

    socket.on("disconnect", async (reason) => {
      console.log("🔌 Cliente desconectado. ID del socket:", socket.id);
      if (socket.userId && socket.userRole === 'driver') {
        try {
          const objectIdOfUser = new mongoose.Types.ObjectId(socket.userId);
          const updatedDriver = await Driver.findOneAndUpdate(
            { userId: objectIdOfUser },
            { isAvailable: false },
            { new: true }
          );

          if (updatedDriver) {
            console.log(`✅ Conductor ${socket.userId} (User ID) marcado como NO DISPONIBLE tras desconexión.`);
            io.emit('driverUnavailable', { driverId: updatedDriver._id.toString() });
          } else {
            console.warn(`⚠️ Conductor con User ID ${socket.userId} no encontrado para marcar como no disponible.`);
          }
        } catch (error) {
          console.error('❌ Error al marcar conductor como no disponible al desconectar:', error.message);
        }
      }
    });
  });
};