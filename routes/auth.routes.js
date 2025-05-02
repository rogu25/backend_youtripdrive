const express = require("express");
const router = express.Router();
const { register, login } = require("../controllers/auth.controller");

const authMiddleware = require("../middlewares/auth.middleware");

router.get("/me", authMiddleware, async (req, res) => {
  res.json({ message: "Autenticación exitosa", userId: req.userId });
});


router.post("/register", register);
router.post("/login", login);

module.exports = router;
