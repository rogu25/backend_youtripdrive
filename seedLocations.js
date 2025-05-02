// seedLocations.js
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const Location = require("./models/Location");
const User = require("./models/User");

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("📦 Conectado a MongoDB");

    // Buscar algunos usuarios con rol conductor
    const conductores = await User.find({ role: "conductor" }).limit(3);

    if (conductores.length === 0) {
      console.log("❌ No hay conductores en la base de datos.");
      return;
    }

    const ubicaciones = [
      { latitude: -16.4010, longitude: -71.5055 }, //
      { latitude: -16.4144, longitude: -71.50434 }, // cerca, 
      { latitude: -16.4110, longitude: -71.52838 }, // cerca , 
    ];

    await Location.deleteMany({}); // Limpiar anteriores

    for (let i = 0; i < conductores.length; i++) {
        await Location.create({
            user: conductores[i]._id,
            coordinates: {
              lat: ubicaciones[i].latitude,
              lng: ubicaciones[i].longitude,
            },
          });
          
    }

    console.log("✅ Ubicaciones insertadas correctamente");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();


