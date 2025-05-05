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
    const conductores = await User.find({ role: "conductor" });

    if (conductores.length === 0) {
      console.log("❌ No hay conductores en la base de datos.");
      return;
    }

    const ubicaciones = [
      { latitude: -16.4010, longitude: -71.5055 }, //
      { latitude: -16.4144, longitude: -71.50434 }, // cerca, 
      { latitude: -16.4110, longitude: -71.52838 },
      { latitude: -16.4120, longitude: -71.52810 },
      { latitude: -16.4130, longitude: -71.53820 },
      { latitude: -16.4140, longitude: -71.54830 },
      { latitude: -16.4150, longitude: -71.49840 }, // cerca , 
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


