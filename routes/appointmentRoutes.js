const express = require('express');
const appointmentController = require('../controllers/appointmentController');

const router = express.Router();

router.post('/book-appointment', appointmentController.bookAppointment);
router.get('/appointmenthavebook', appointmentController.getUniqueAppointments);
router.get('/', appointmentController.getAppointments);
router.put('/hour_appointments/:id', appointmentController.updateAppointment);
router.delete('/hour_appointments/:id', appointmentController.deleteAppointment);
router.put('/:id/confirm', appointmentController.confirmAppointment);
router.put('/:id/reject', appointmentController.rejectAppointment);

module.exports = router;