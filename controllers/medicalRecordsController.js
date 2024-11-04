const db = require('../db');

exports.getMedicalRecords = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                medical_records.id,
                patients.fullname AS patient_name,
                doctors.fullname AS doctor_name,
                medical_records.diagnosis,
                medical_records.treatment,
                medical_records.record_date
            FROM medical_records
                     JOIN patients ON medical_records.patient_id = patients.id
                     JOIN doctors ON medical_records.doctor_id = doctors.id
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch medical records' });
    }
};

exports.addMedicalRecord = async (req, res) => {
    const { patient_id, doctor_id, diagnosis, treatment, record_date } = req.body;
    console.log('Received data:', { patient_id, doctor_id, diagnosis, treatment, record_date });
    try {
        const result = await db.query(
            'INSERT INTO medical_records (patient_id, doctor_id, diagnosis, treatment, record_date) VALUES (?, ?, ?, ?, ?) RETURNING *',
            [patient_id, doctor_id, diagnosis, treatment, record_date]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error adding medical record:', error);
        res.status(500).json({ error: 'Failed to add medical record', details: error.message });
    }
};

exports.updateMedicalRecord = async (req, res) => {
    const { id } = req.params;
    const { patient_id, doctor_id, diagnosis, treatment, record_date } = req.body;
    try {
        const result = await db.query(
            'UPDATE medical_records SET patient_id = ?, doctor_id = ?, diagnosis = ?, treatment = ?, record_date = ? WHERE id = ? RETURNING *',
            [patient_id, doctor_id, diagnosis, treatment, record_date, id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update medical record' });
    }
};

exports.deleteMedicalRecord = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM medical_records WHERE id = ?', [id]);
        res.json({ message: 'Medical record deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete medical record' });
    }
};