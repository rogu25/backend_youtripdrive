const Message = require("../models/Message");
const Driver = require("../models/Driver");
const Ride = require("../models/Ride");
const User = require("../models/User");
const mongoose = require("mongoose");
const { calculateEta } = require("./googleMapsService");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("🔌 Nuevo cliente conectado. ID del socket:", socket.id);

    const userIdFromQuery = socket.handshake.query.userId;
    const role = socket.handshake.query.role;

    if (userIdFromQuery) {
      socket.userId = userIdFromQuery;
      socket.userRole = role;
      socket.join(userIdFromQuery);
      console.log(
        `[Socket:Connection] Usuario ${userIdFromQuery} (${
          role || "desconocido"
        }) se unió a su sala personal.`
      );
    }

    socket.on("join", (id) => {
      socket.join(id);
      socket.userId = id;
      console.log(
        `[Socket:JoinEvent] Usuario ${id} se unió a su sala personal (via evento 'join').`
      );
    });

    socket.on("join_ride_chat", (rideId) => {
      socket.join(`ride_${rideId}`);
      console.log(
        `[Socket:JoinRideChat] Cliente se unió al chat del viaje: ride_${rideId}`
      );
    });

    // -----------------------------------------------------
    // ✅ CORREGIDO: Manejo de la solicitud de viaje del pasajero
    // -----------------------------------------------------
    socket.on("requestRide", async (rideData) => {
      console.log(
        `[Socket:requestRide] Solicitud de viaje recibida del pasajero ${rideData.passengerId}.`
      );
      console.log("Datos del viaje:", rideData);

      try {
        // 1. Guardar el nuevo viaje en la base de datos con estado 'buscando'
        const newRide = new Ride({
          passenger: rideData.passengerId,
          // *** ¡IMPORTANTE: Coincidiendo con los nombres del modelo Ride.js! ***
          origin: {
            // El modelo Ride espera un campo 'origin'
            latitude: rideData.pickupLocation.latitude,
            longitude: rideData.pickupLocation.longitude,
            address: rideData.pickupLocation.address, // Asegúrate de que el frontend lo envíe
          },
          destination: {
            // El modelo Ride espera un campo 'destination'
            latitude: rideData.destination.latitude,
            longitude: rideData.destination.longitude,
            address: rideData.destination.address, // Asegúrate de que el frontend lo envíe
          },
          price_offered: rideData.estimatedFare, // El modelo Ride espera 'price_offered'
          // Los siguientes campos no están en el modelo Ride directamente como requeridos
          // pero los incluimos para mantener la información del frontend si es necesaria
          // Podrías considerar añadirlos al esquema de Ride si son fundamentales
          // estimatedDuration: rideData.estimatedDuration,
          // estimatedDistance: rideData.estimatedDistance,
          status: "buscando",
          requestedAt: new Date(),
        });
        await newRide.save();
        console.log(
          `[Socket:requestRide] Viaje ${newRide._id} guardado en DB con estado 'buscando'.`
        );

        // 2. Encontrar conductores disponibles
        const availableDrivers = await Driver.find({ isAvailable: true });

        if (availableDrivers.length === 0) {
          console.log(
            `[Socket:requestRide] No hay conductores disponibles para el viaje ${newRide._id}.`
          );
          io.to(rideData.passengerId).emit("noDriverFound", {
            rideId: newRide._id.toString(),
          });
          return;
        }

        console.log(
          `[Socket:requestRide] Se encontraron ${availableDrivers.length} conductores disponibles.`
        );

        // 3. Emitir la solicitud de viaje a cada conductor disponible
        const tripRequestData = {
          rideId: newRide._id.toString(),
          passengerId: newRide.passenger.toString(),
          pickupLocation: newRide.origin, // Ahora se llama 'origin' en el modelo
          destination: newRide.destination, // Ahora se llama 'destination' en el modelo
          estimatedFare: newRide.price_offered, // Usamos 'price_offered' del ride guardado
          estimatedDuration: rideData.estimatedDuration, // Mantenemos el dato original del frontend si no lo guardamos en Ride
          estimatedDistance: rideData.estimatedDistance, // Mantenemos el dato original del frontend si no lo guardamos en Ride
          status: newRide.status,
        };

        availableDrivers.forEach((driver) => {
          if (driver.userId) {
            io.to(driver.userId.toString()).emit(
              "tripRequest",
              tripRequestData
            );
            console.log(
              `[Socket:requestRide] 'tripRequest' emitido al conductor ${driver.userId} para el viaje ${newRide._id}.`
            );
          } else {
            console.warn(
              `[Socket:requestRide] Conductor ${driver._id} no tiene un userId asociado. No se pudo emitir la solicitud.`
            );
          }
        });

        socket.join(`ride_${newRide._id.toString()}`);
        console.log(
          `[Socket] Pasajero ${newRide.passenger.toString()} se unió a la sala del viaje ride_${newRide._id.toString()}.`
        );
      } catch (error) {
        console.error(
          "[Socket:requestRide] Error al procesar solicitud de viaje:",
          error.message
        );
        io.to(rideData.passengerId).emit("rideRequestFailed", {
          message: "Error interno al procesar su solicitud de viaje.",
        });
      }
    });

    // -----------------------------------------------------
    // ✅ SOLUCIÓN DEFINITIVA: El conductor acepta un viaje
    // -----------------------------------------------------
    socket.on("driver_accepts_ride", async ({ rideId, driverId }) => {
      // driverId aquí es el userId (ObjectId del User asociado)
      console.log(
        `[AcceptRide] DEBUG: Evento 'driver_accepts_ride' recibido. rideId: ${rideId}, driverId (userId): ${driverId}`
      );
      try {
        // Paso 1: Encontrar el documento Driver usando el userId recibido
        const driverDoc = await Driver.findOne({ userId: driverId });
        console.log(
          `[AcceptRide] DEBUG: Driver encontrado por userId ${driverId}: ${JSON.stringify(
            driverDoc ? driverDoc._id : null
          )}`
        );

        if (!driverDoc) {
          console.error(
            `[AcceptRide] Error: No se encontró documento Driver para el userId: ${driverId}.`
          );
          socket.emit("error", {
            message: "Conductor no encontrado o no válido.",
          });
          return;
        }

        const actualDriverObjectId = driverDoc._id; // Este es el _id del documento Driver

        // Paso 2: Actualizar el viaje con el _id correcto del documento Driver
        const ride = await Ride.findByIdAndUpdate(
          rideId,
          {
            status: "aceptado",
            driver: actualDriverObjectId,
            acceptedAt: new Date(),
          }, // Usa el _id del documento Driver
          { new: true }
        )
          .populate("passenger", "name")
          .populate({
            path: "driver",
            model: "Driver",
            select: "name carDetails currentLocation userId", // Asegura que userId también se popule
          });

        console.log(
          `[AcceptRide] DEBUG: Resultado de findByIdAndUpdate y populate: ${JSON.stringify(
            ride,
            null,
            2
          )}`
        );

        if (!ride) {
          console.log(
            `[Socket:driver_accepts_ride] Viaje ${rideId} no encontrado.`
          );
          socket.emit("error", {
            message: "Viaje no encontrado o ya no disponible para aceptar.",
          });
          return;
        }

        if (!ride.driver) {
          // Si llegamos aquí, significa que la populación falló a pesar de tener el _id correcto.
          // Esto indicaría un problema en la definición del modelo Ride o Driver, o corrupción de datos.
          console.error(
            `[Socket:driver_accepts_ride] Error: Conductor NO populado para el viaje ${rideId} después de la actualización. Esto es inesperado.`
          );
          socket.emit("error", {
            message:
              "No se pudieron obtener los detalles del conductor después de aceptar el viaje.",
          });
          return;
        }

        console.log(
          `[Socket:driver_accepts_ride] Viaje ${rideId} aceptado por conductor ${ride.driver.name}.`
        );

        const passengerPickupLocation = ride.origin;
        const driverCurrentLocation = ride.driver.currentLocation;

        let pickupEta = null;
        if (
          driverCurrentLocation &&
          driverCurrentLocation.latitude != null &&
          passengerPickupLocation &&
          passengerPickupLocation.latitude != null
        ) {
          pickupEta = await calculateEta(
            driverCurrentLocation,
            passengerPickupLocation
          );
        } else {
          console.warn(
            `[Socket:driver_accepts_ride] Faltan coordenadas para calcular ETA. Conductor: ${JSON.stringify(
              driverCurrentLocation
            )}, Pasajero: ${JSON.stringify(passengerPickupLocation)}`
          );
        }

        io.to(ride.passenger._id.toString()).emit("ride_accepted", {
          ride: ride,
          pickupEta: pickupEta,
        });
        console.log(
          `[Socket] 'ride_accepted' emitido a pasajero ${ride.passenger._id} para ride ${ride._id}`
        );

        socket.join(`ride_${ride._id}`);
        io.to(ride.driver.userId.toString()).emit("ride_status_updated", {
          rideId: ride._id.toString(),
          newStatus: ride.status,
          driverId: ride.driver.userId.toString(),
        });
      } catch (error) {
        console.error(
          "[Socket:driver_accepts_ride] Error en el bloque catch:",
          error.message
        );
        socket.emit("error", { message: "Error interno al aceptar el viaje." });
      }
    });

    // -----------------------------------------------------
    // ✅ REVISADO: Manejo de actualización de ubicación del conductor
    // -----------------------------------------------------
    socket.on("driverLocationUpdate", async (data) => {
      const { driverId, latitude, longitude, isAvailable } = data;

      try {
        const objectIdOfUser = new mongoose.Types.ObjectId(driverId);

        const updatedDriver = await Driver.findOneAndUpdate(
          { userId: objectIdOfUser },
          {
            $set: {
              "currentLocation.latitude": latitude,
              "currentLocation.longitude": longitude,
            },
            isAvailable: isAvailable,
          },
          { new: true, runValidators: true }
        );

        if (updatedDriver) {
          console.log(
            `[Socket:driverLocationUpdate] Ubicación de conductor ${driverId} (User ID) actualizada en DB. Disponible: ${updatedDriver.isAvailable}`
          );

          if (updatedDriver.isAvailable) {
            io.emit("driverLocationUpdateForPassengers", {
              driverId: updatedDriver.userId.toString(),
              latitude: updatedDriver.currentLocation.latitude,
              longitude: updatedDriver.currentLocation.longitude,
              driverName: updatedDriver.name,
              isAvailable: updatedDriver.isAvailable,
            });
          } else {
            io.emit("driverUnavailable", {
              driverId: updatedDriver.userId.toString(),
            });
            console.log(
              `[Socket] 🚫 Conductor ${driverId} marcado como NO DISPONIBLE. Emitiendo 'driverUnavailable'.`
            );
          }

          const ride = await Ride.findOne({
            driver: updatedDriver._id,
            status: { $in: ["aceptado", "recogido", "en_ruta"] },
          }).populate("passenger", "_id");

          if (ride) {
            let eta = null;
            let destinationLocation = null;

            if (ride.status === "aceptado") {
              destinationLocation = ride.origin; // El destino para el ETA al recoger es el origen del viaje
            } else if (
              ride.status === "recogido" ||
              ride.status === "en_ruta"
            ) {
              destinationLocation = ride.destination; // El destino para el ETA en ruta es el destino final del viaje
            }

            if (destinationLocation && updatedDriver.currentLocation) {
              eta = await calculateEta(
                updatedDriver.currentLocation,
                destinationLocation
              );
            }

            io.to(ride.passenger._id.toString()).emit(
              "driverLocationUpdateForAssignedRide",
              {
                rideId: ride._id.toString(),
                driverId: updatedDriver.userId.toString(),
                latitude: latitude,
                longitude: longitude,
                eta: eta,
                currentRideStatus: ride.status,
              }
            );
            console.log(
              `[Socket] 'driverLocationUpdateForAssignedRide' emitido a pasajero ${
                ride.passenger._id
              } para ride ${ride._id}. ETA: ${eta || "N/A"}`
            );
          }
        } else {
          console.warn(
            `[Socket:driverLocationUpdate] ⚠️ Conductor con User ID ${driverId} no encontrado en la base de datos para actualizar.`
          );
        }
      } catch (error) {
        console.error(
          "❌ Error al actualizar o emitir ubicación de conductor:",
          error.message
        );
      }
    });

    socket.on("driverSetUnavailable", async (data) => {
      const { driverId } = data;
      try {
        const objectIdOfUser = new mongoose.Types.ObjectId(driverId);
        const updatedDriver = await Driver.findOneAndUpdate(
          { userId: objectIdOfUser },
          { isAvailable: false },
          { new: true }
        );

        if (updatedDriver) {
          console.log(
            `[Socket:driverSetUnavailable] ✅ Conductor ${driverId} (User ID) marcado explícitamente como NO DISPONIBLE.`
          );
          io.emit("driverUnavailable", {
            driverId: updatedDriver.userId.toString(),
          });
        } else {
          console.warn(
            `[Socket:driverSetUnavailable] ⚠️ Conductor con User ID ${driverId} no encontrado para marcar como no disponible.`
          );
        }
      } catch (error) {
        console.error(
          "❌ Error al marcar conductor como no disponible explícitamente:",
          error.message
        );
      }
    });

    socket.on("send_message", async (msg) => {
      try {
        const { rideId, senderId, content } = msg;
        if (!rideId || !senderId || !content) {
          console.error("❌ Mensaje incompleto recibido:", msg);
          socket.emit("message_error", {
            message: "Datos de mensaje incompletos.",
          });
          return;
        }
        const newMessage = new Message({ rideId, sender: senderId, content });
        await newMessage.save();
        const populatedMsg = await newMessage.populate("sender", "name");
        io.to(`ride_${rideId}`).emit("receive_message", populatedMsg);
        console.log(
          `[Socket:SendMessage] Mensaje de ${senderId} en ride ${rideId} enviado.`
        );
      } catch (err) {
        console.error("❌ Error al guardar o emitir mensaje:", err.message);
        socket.emit("message_error", {
          message: "Error interno al enviar mensaje.",
          details: err.message,
        });
      }
    });

    socket.on("typing", ({ rideId, senderId }) => {
      socket.to(`ride_${rideId}`).emit("user_typing", { senderId });
    });

    // -----------------------------------------------------
    // ✅ REVISADO: Manejo de cancelación de viaje por el pasajero
    // -----------------------------------------------------
    socket.on(
      "ride_cancelled_by_passenger",
      async ({ rideId, passengerId }) => {
        try {
          const ride = await Ride.findByIdAndUpdate(
            rideId,
            {
              status: "cancelado",
              cancelledBy: "pasajero",
              cancelledAt: new Date(),
            },
            { new: true }
          )
            .populate("passenger")
            .populate("driver", "userId");

          if (!ride) {
            console.log(
              `[Socket:ride_cancelled_by_passenger] Viaje ${rideId} no encontrado.`
            );
            return;
          }

          console.log(
            `[Socket] Viaje ${rideId} cancelado por pasajero ${passengerId}.`
          );

          if (ride.driver && ride.driver.userId) {
            io.to(ride.driver.userId.toString()).emit("ride_status_updated", {
              rideId: ride._id.toString(),
              newStatus: "cancelado",
              reason: "Pasajero canceló el viaje.",
              driverId: ride.driver.userId.toString(),
              passengerId: passengerId,
            });
            console.log(
              `[Socket] 'ride_status_updated' (cancelado) emitido a driver ${ride.driver.userId}.`
            );
          }

          io.to(ride.passenger._id.toString()).emit("ride_status_updated", {
            rideId: ride._id.toString(),
            newStatus: "cancelado",
            reason: "Viaje cancelado exitosamente.",
            passengerId: passengerId,
          });
        } catch (error) {
          console.error(
            "[Socket:ride_cancelled_by_passenger] Error:",
            error.message
          );
        }
      }
    );

    // -----------------------------------------------------
    // ✅ REVISADO: Evento de actualización general del estado del viaje
    // -----------------------------------------------------
    socket.on(
      "update_ride_status",
      async ({ rideId, newStatus, driverUserId }) => {
        try {
          const ride = await Ride.findByIdAndUpdate(
            rideId,
            { status: newStatus },
            { new: true }
          )
            .populate("passenger")
            .populate("driver", "userId");

          if (!ride) {
            console.log(
              `[Socket:update_ride_status] Viaje ${rideId} no encontrado.`
            );
            return;
          }

          console.log(
            `[Socket] Viaje ${rideId} status actualizado a: ${newStatus} por conductor ${driverUserId}.`
          );

          io.to(ride.passenger._id.toString()).emit("ride_status_updated", {
            rideId: ride._id.toString(),
            newStatus: newStatus,
            passengerId: ride.passenger._id.toString(),
          });

          io.to(ride.driver.userId.toString()).emit("ride_status_updated", {
            rideId: ride._id.toString(),
            newStatus: newStatus,
            driverId: ride.driver.userId.toString(),
          });
        } catch (error) {
          console.error("[Socket:update_ride_status] Error:", error.message);
        }
      }
    );

    socket.on("disconnect", async (reason) => {
      console.log(
        "🔌 Cliente desconectado. ID del socket:",
        socket.id,
        "Razón:",
        reason
      );
      if (socket.userId && socket.userRole === "conductor") {
        try {
          const objectIdOfUser = new mongoose.Types.ObjectId(socket.userId);
          const updatedDriver = await Driver.findOneAndUpdate(
            { userId: objectIdOfUser },
            { isAvailable: false },
            { new: true }
          );

          if (updatedDriver) {
            console.log(
              `[Socket:Disconnect] ✅ Conductor ${socket.userId} (User ID) marcado como NO DISPONIBLE tras desconexión.`
            );
            io.emit("driverUnavailable", {
              driverId: updatedDriver.userId.toString(),
            });
          } else {
            console.warn(
              `[Socket:Disconnect] ⚠️ Conductor con User ID ${socket.userId} no encontrado para marcar como no disponible.`
            );
          }
        } catch (error) {
          console.error(
            "❌ Error al marcar conductor como no disponible al desconectar:",
            error.message
          );
        }
      }
    });
  });
};
