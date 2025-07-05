// backend/controllers/driverController.js
const User = require('../models/User'); // Asumo que tu modelo de usuario maneja la disponibilidad

exports.updateDriverAvailability = async (req, res) => {
    try {
        const { id } = req.params; // ID del conductor de la URL
        const { isAvailable } = req.body; // Nuevo estado de disponibilidad desde el frontend

        // 1. Validar que el usuario logueado sea el mismo que se está actualizando (o un admin)
        if (req.userId.toString() !== id) {
            return res.status(403).json({ message: "No autorizado para actualizar la disponibilidad de otro conductor." });
        }

        // 2. Validar que 'isAvailable' sea un booleano
        if (typeof isAvailable !== 'boolean') {
            return res.status(400).json({ message: "El estado de disponibilidad debe ser un valor booleano (true/false)." });
        }

        // 3. Buscar y actualizar el usuario (conductor) en la base de datos
        // Asumo que tu modelo User tiene un campo 'isAvailable'
        const driver = await User.findById(id);

        if (!driver || driver.role !== 'conductor') {
            return res.status(404).json({ message: "Conductor no encontrado." });
        }

        driver.isAvailable = isAvailable;
        await driver.save();

        // Opcional: Emitir por Socket.IO a otros servicios o clientes si la disponibilidad cambia
        // const io = req.app.get("io");
        // if (io) {
        //     io.emit('driver_availability_changed', { driverId: id, isAvailable: isAvailable });
        // }

        res.status(200).json({ message: "Disponibilidad actualizada exitosamente.", isAvailable: driver.isAvailable });

    } catch (error) {
        console.error("❌ Error al actualizar disponibilidad del conductor:", error);
        res.status(500).json({ message: "Error interno del servidor al actualizar disponibilidad." });
    }
};

exports.getDriverAvailability = async (req, res) => {
    try {
        const { id } = req.params; // ID del conductor de la URL

        // 1. Validar que el usuario logueado sea el mismo que consulta (o un admin)
        if (req.userId.toString() !== id) {
            return res.status(403).json({ message: "No autorizado para ver la disponibilidad de otro conductor." });
        }

        // 2. Buscar el usuario (conductor) en la base de datos
        const driver = await User.findById(id).select('isAvailable role'); // Solo trae los campos que necesitas

        if (!driver || driver.role !== 'conductor') {
            return res.status(404).json({ message: "Conductor no encontrado." });
        }

        // 3. Devolver el estado de disponibilidad
        res.status(200).json({ isAvailable: driver.isAvailable });

    } catch (error) {
        console.error("❌ Error al obtener disponibilidad del conductor:", error);
        // Si el ID es inválido, mongoose lanza un CastError
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "ID de conductor inválido." });
        }
        res.status(500).json({ message: "Error interno del servidor al obtener disponibilidad." });
    }
};