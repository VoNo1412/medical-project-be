const db = require('../db'); // Adjust the path as necessary

exports.bookAppointment = async (req, res) => {
    console.log("Book appointment request received", req.body);
    await db.query("START TRANSACTION");
    const { fullname, phone, address, gender, birthYear, appointmentDate, appointmentTime, doctorId, content } = req.body;
    try {
        const insertBookingSql = 'INSERT INTO booking_appointments (fullname, phone, address, gender, birth_year, appointment_date, appointment_time, doctor_id, content) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
        await db.execute(insertBookingSql, [fullname, phone, address, gender, birthYear, appointmentDate, appointmentTime, doctorId, content]);

        await db.query("COMMIT");
        console.log("Appointment booked successfully");
        return res.status(200).json({ message: "Appointment booked successfully" });
    } catch (error) {
        console.log("Failed to book appointment", error);
        await db.query("ROLLBACK");
        return res.status(500).json({ message: "An error occurred while booking the appointment" });
    }
};

exports.getAppointments = async (req, res) => {
    console.log("Get appointments request received");
    try {
        const selectAppointmentsSql = `
            SELECT
                ba.id,
                ba.fullname,
                ba.phone,
                ba.address,
                ba.gender,
                ba.birth_year,
                ba.appointment_date,
                ba.appointment_time,
                d.fullname AS doctor_name,
                ba.content,
                ba.created_at
            FROM
                booking_appointments ba
                    JOIN
                doctors d ON ba.doctor_id = d.id
        `;
        const [appointments,] = await db.query(selectAppointmentsSql);

        console.log("Appointments retrieved", appointments);
        return res.json(appointments);
    } catch (error) {
        console.log("Failed to retrieve appointments", error);
        return res.status(500).json({ message: "An error occurred while fetching the appointments" });
    }
};

exports.updateAppointment = async (req, res) => {
    console.log("Update appointment request received", req.body);
    const { id } = req.params;
    const { doctor_id, appointment_date, appointment_hour, patient_name, patient_phone, patient_address, patient_gender, patient_birth_year, appointment_reason } = req.body;
    try {
        const updateAppointmentSql = 'UPDATE hour_appointments SET doctor_id = ?, appointment_date = ?, appointment_hour = ?, patient_name = ?, patient_phone = ?, patient_address = ?, patient_gender = ?, patient_birth_year = ?, appointment_reason = ? WHERE id = ?';
        await db.execute(updateAppointmentSql, [doctor_id, appointment_date, appointment_hour, patient_name, patient_phone, patient_address, patient_gender, patient_birth_year, appointment_reason, id]);

        console.log("Appointment updated successfully");
        return res.status(200).json({ message: "Appointment updated successfully" });
    } catch (error) {
        console.log("Failed to update appointment", error);
        return res.status(500).json({ message: "An error occurred while updating the appointment" });
    }
};

exports.deleteAppointment = async (req, res) => {
    console.log("Delete appointment request received", req.params);
    const { id } = req.params;
    try {
        const deleteAppointmentSql = 'DELETE FROM hour_appointments WHERE id = ?';
        await db.execute(deleteAppointmentSql, [id]);

        console.log("Appointment deleted successfully");
        return res.status(200).json({ message: "Appointment deleted successfully" });
    } catch (error) {
        console.log("Failed to delete appointment", error);
        return res.status(500).json({ message: "An error occurred while deleting the appointment" });
    }
};