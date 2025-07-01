// backend/server.js
require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const socketIO = require("socket.io");

// Rutas y modelos
const messageRoutes = require("./routes/message.routes");
const authRoutes = require("./routes/auth.routes");
const rideRoutes = require("./routes/ride.routes");
const locationRoutes = require("./routes/location.routes");
const Message = require("./models/Message");

// Inicializar Express y servidor HTTP
const app = express();
const server = http.createServer(app);

// Configurar Socket.IO
const io = socketIO(server, {
  cors: {
    origin: "*",
  },
});

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas API REST
app.use("/api/auth", authRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/messages", messageRoutes); // ✅ Solo una vez

// Conexión a MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Conectado a MongoDB"))
  .catch((err) => console.error("❌ Error en conexión MongoDB:", err));

// Socket.IO
io.on("connection", (socket) => {
  console.log("🔌 Nuevo cliente conectado");

  socket.on("join", (userId) => {
    socket.join(userId);
  });

  socket.on("join_ride_chat", (rideId) => {
    socket.join(`ride_${rideId}`);
  });

  socket.on("send_message", async (msg) => {
    try {
      const { rideId, senderId, content } = msg;
      const newMessage = new Message({ rideId, sender: senderId, content });
      await newMessage.save();
      const populatedMsg = await newMessage.populate("sender", "name");

      io.to(`ride_${rideId}`).emit("receive_message", populatedMsg);
    } catch (err) {
      console.error("❌ Error al guardar mensaje:", err.message);
    }
  });

  socket.on("typing", ({ rideId, senderId }) => {
    socket.to(`ride_${rideId}`).emit("user_typing", { senderId });
  });

  socket.on("disconnect", () => {
    console.log("🔌 Cliente desconectado");
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 4000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor backend corriendo en el puerto ${PORT}`);
});

// Guardar instancia de io en app
app.set("io", io);
