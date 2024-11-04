const db = require('../db');

// Get all follow-up appointments
exports.getAllFollowUpAppointments = async (req, res) => {
    try {
        const [appointments,] = await db.query('SELECT * FROM follow_up_appointments');
        return res.json(appointments);
    } catch (error) {
        console.error('Error fetching follow-up appointments:', error);
        return res.status(500).json({ message: 'An error occurred while fetching follow-up appointments' });
    }
};

// Add a new follow-up appointment
exports.addFollowUpAppointment = async (req, res) => {
    const { patient_name, follow_up_date, notes } = req.body;
    try {
        const insertAppointmentSql = 'INSERT INTO follow_up_appointments (patient_name, follow_up_date, notes, created_at) VALUES (?, ?, ?, NOW())';
        await db.execute(insertAppointmentSql, [patient_name, follow_up_date, notes]);
        return res.status(200).json({ message: 'Follow-up appointment added successfully' });
    } catch (error) {
        console.error('Error adding follow-up appointment:', error);
        return res.status(500).json({ message: 'An error occurred while adding the follow-up appointment' });
    }
};

// Update an existing follow-up appointment
exports.updateFollowUpAppointment = async (req, res) => {
    const { id } = req.params;
    const { patient_name, follow_up_date, notes } = req.body;
    try {
        const updateAppointmentSql = 'UPDATE follow_up_appointments SET patient_name = ?, follow_up_date = ?, notes = ? WHERE id = ?';
        await db.execute(updateAppointmentSql, [patient_name, follow_up_date, notes, id]);
        return res.status(200).json({ message: 'Follow-up appointment updated successfully' });
    } catch (error) {
        console.error('Error updating follow-up appointment:', error);
        return res.status(500).json({ message: 'An error occurred while updating the follow-up appointment' });
    }
};

// Delete a follow-up appointment
exports.deleteFollowUpAppointment = async (req, res) => {
    const { id } = req.params;
    try {
        const deleteAppointmentSql = 'DELETE FROM follow_up_appointments WHERE id = ?';
        await db.execute(deleteAppointmentSql, [id]);
        return res.status(200).json({ message: 'Follow-up appointment deleted successfully' });
    } catch (error) {
        console.error('Error deleting follow-up appointment:', error);
        return res.status(500).json({ message: 'An error occurred while deleting the follow-up appointment' });
    }
};