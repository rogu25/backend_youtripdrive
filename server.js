// backend/server.js
require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const socketIO = require("socket.io");

const authRoutes = require("./routes/auth.routes");
const rideRoutes = require("./routes/ride.routes");
const { socketHandler } = require("./sockets/socketHandler");
const locationRoutes = require("./routes/location.routes");

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
  },
});

const messageRoutes = require("./routes/message.routes");

app.use(cors());
app.use(express.json());

// Rutas API REST
app.use("/api/auth", authRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/messages", messageRoutes);

// Conexión a MongoDB
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Conectado a MongoDB"))
  .catch((err) => console.error(err));

// Socket.io
io.on("connection", (socket) => socketHandler(socket, io));

// Servidor corriendo
const PORT = process.env.PORT || 4000;

app.listen(4000, '0.0.0.0', () => {
  console.log("Servidor backend corriendo en el puerto 4000");
});


app.set("io", io);