const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const { getRideMessages } = require("../controllers/message.controller");

router.get("/:rideId", auth, getRideMessages);

module.exports = router;
