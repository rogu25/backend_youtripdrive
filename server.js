// backend/server.js
require("dotenv").config(); // Cargar variables de entorno al inicio.

const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const socketIO = require("socket.io");

// Importar rutas
const authRoutes = require("./routes/auth.routes");
const rideRoutes = require("./routes/ride.routes");
const locationRoutes = require("./routes/location.routes");
const messageRoutes = require("./routes/message.routes");

// Importar el manejador de sockets
const socketHandler = require("./sockets/socketHandler");

// Inicializar Express y servidor HTTP
const app = express();
const server = http.createServer(app);

// Configurar Socket.IO
const io = socketIO(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*", // Mejor usar una variable de entorno para el cliente. En producción, especificar dominios.
    methods: ["GET", "POST"], // Métodos permitidos explícitamente para mayor seguridad.
  },
});

// Middlewares
app.use(cors());
app.use(express.json()); // Para parsear cuerpos de solicitudes JSON

// Rutas API REST
app.use("/api/auth", authRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/messages", messageRoutes);

// Conexión a MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    // Estas opciones son obsoletas en Mongoose 6.x y superiores.
    // Si usas una versión anterior, descomenta las líneas.
    // useNewUrlParser: true,
    // useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Conectado a MongoDB"))
  .catch((err) => console.error("❌ Error en conexión MongoDB:", err));

// Manejo de Socket.IO
// Toda la lógica de conexión y eventos de sockets se ha movido a socketHandler.js
socketHandler(io);

// Guardar instancia de io en app para acceso desde controladores Express
app.set("io", io);

// Iniciar servidor
const PORT = process.env.PORT || 4000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor backend corriendo en el puerto ${PORT}`);
});