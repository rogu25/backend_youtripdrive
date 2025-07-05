const express = require("express");
const router = express.Router();
// Importa los controladores de autenticación
const { register, login } = require("../controllers/auth.controller");

// Importa el middleware de autenticación
const authMiddleware = require("../middlewares/auth.middleware");

// === RUTA ORIGINAL:
// router.get("/me", authMiddleware, async (req, res) => {
//   res.json({ message: "Autenticación exitosa", userId: req.userId });
// });

// === SUGERENCIA: Mover la lógica de '/me' a un controlador
// 1. Añade una nueva función 'getMe' en tu auth.controller.js
// 2. Luego, en esta ruta, simplemente la llamas:
router.get("/me", authMiddleware, require("../controllers/auth.controller").getMe);
// O si la importas explícitamente:
// const { register, login, getMe } = require("../controllers/auth.controller");
// router.get("/me", authMiddleware, getMe);

// Rutas de autenticación
router.post("/register", register);
router.post("/login", login);

module.exports = router;