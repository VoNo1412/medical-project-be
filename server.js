// Import thư viện dotenv để quản lý biến môi trường
require('dotenv').config();

// Import thư viện express để xây dựng ứng dụng web
const express = require('express');

// Import thư viện mysql để kết nối với cơ sở dữ liệu MySQL
const mysql = require('mysql2/promise');

// Import thư viện cors để cho phép các yêu cầu từ các nguồn khác nhau
const cors = require('cors');

// Import thư viện bcrypt để mã hóa mật khẩu
const bcrypt = require('bcrypt');

const jwt = require('jsonwebtoken');

// Import thư viện cookie-parser để xử lý cookie
const cookieParser = require('cookie-parser');

// Tạo một instance của ứng dụng Express
const app = express();

// Cấu hình middleware để xử lý dữ liệu JSON trong các yêu cầu
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: [
        'http://localhost:3000',
        'https://545b-42-114-32-182.ngrok-free.app',
        'https://nhakhoa-72d284770bf0.herokuapp.com'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Tạo kết nối đến cơ sở dữ liệu MySQL

let db = null;

async function connectDatabase() {
    db = await mysql.createPool({
        host: process.env.DB_HOST || "103.221.222.62",
        user: process.env.DB_USER || "waghgljj_nhakhoauser",
        port: process.env.DB_PORT || 3306,
        password: process.env.DB_PASSWORD || "!pr9bTW8vmeLwHY",
        database: process.env.DB_NAME || "waghgljj_nhakhoa",
        timezone: '+07:00',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
    console.log("Database connected");
}

connectDatabase();

// Authentication middleware
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log("No token provided");
        return res.status(401).json({ message: "Chưa đăng nhập" });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        console.log("Token verified", decoded);
        next();
    } catch (error) {
        console.log("Token verification failed", error);
        return res.status(401).json({ message: "Chưa đăng nhập" });
    }
}

// Định nghĩa route cho đăng nhập
app.post('/login', async (req, res) => {
    console.log("Login request received", req.body);
    const selectUserSql = "SELECT * FROM users WHERE username = ?";

    const [selectUserResult,] = await db.query(selectUserSql, [req.body.username]);

    if (selectUserResult.length > 0) {
        const isValidPassword = bcrypt.compareSync(req.body.password, selectUserResult[0].password);
        if (isValidPassword) {
            console.log("Password is valid");

            // Sign token
            const token = jwt.sign(
                { id: selectUserResult[0].id, role: selectUserResult[0].role },
                process.env.JWT_SECRET,
                { expiresIn: +process.env.COOKIE_EXPIRE_IN }
            );

            res.cookie('token', token, {
                httpOnly: false,
                secure: false,
                maxAge: process.env.COOKIE_EXPIRE_IN * 1000,
                sameSite: 'lax'
            });

            res.setHeader('Access-Control-Allow-Credentials', 'true');

            const response = { message: "Đăng nhập thành công", token };

            if (selectUserResult[0].role === 'admin') {
                console.log("Admin login successful");
                response.redirect = "/admin";
            } else if (selectUserResult[0].role === 'doctor') {
                console.log("Doctor login successful");
                response.redirect = "/doctor";
            } else if (selectUserResult[0].role === 'patient') {
                console.log("Patient login successful");
                response.redirect = "/";
            }

            return res.json(response);
        } else {
            console.log("Invalid password");
            return res.json("Mật khẩu không đúng");
        }
    } else {
        console.log("Username does not exist");
        return res.json("Username không tồn tại");
    }
});

// Định nghĩa route cho đăng ký
app.post('/register', async (req, res) => {
    console.log("Register request received", req.body);
    await db.query("START TRANSACTION");
    try {
        const { username, password, fullname, phone, address, birthYear, gender } = req.body;

        const checkUserSql = "SELECT * FROM users WHERE username = ?";

        const [rows,] = await db.execute(checkUserSql, [username]);

        if (rows.length > 0) {
            console.log("Username already exists");
            return res.json("Username đã tồn tại");
        }

        const hashedPassword = bcrypt.hashSync(password, 10);

        const insertUserSql = "INSERT INTO users (username, password, role, status) VALUES (?, ?, 'patient', 1)";
        const [insertUserResult,] = await db.execute(insertUserSql, [username, hashedPassword]);

        const insertPatientSql = "INSERT INTO patients (user_id, fullname, phone, address, gender, birth_year) VALUES (?, ?, ?, ?, ?, ?)";
        await db.execute(insertPatientSql, [insertUserResult.insertId, fullname, phone, address, gender, birthYear]);

        await db.query("COMMIT");
        console.log("Registration successful");
        return res.json("Đăng ký thành công");
    } catch (error) {
        console.log("Registration failed", error);
        await db.query("ROLLBACK");
        return res.json("Có lỗi xảy ra. Vui lòng thử lại");
    }
});

app.get('/me', authMiddleware, async (req, res) => {
    console.log("Get user info request received");
    try {
        const selectUserSql = "SELECT * FROM users WHERE id = ?";
        const [selectUserResult,] = await db.query(selectUserSql, [req.user.id]);

        if (selectUserResult.length === 0) {
            console.log("User not logged in");
            return res.status(401).json({ message: "Chưa đăng nhập" });
        }

        const user = selectUserResult[0]; // without password
        delete user.password;

        if (selectUserResult[0].role === 'admin') {
            console.log("Admin user info retrieved");
            return res.json({
                user: selectUserResult[0],
                profile: null
            });
        }

        if (selectUserResult[0].role === 'doctor') {
            const selectDoctorSql = "SELECT * FROM doctors WHERE user_id = ?";
            const [selectDoctorResult,] = await db.query(selectDoctorSql, [req.user.id]);
            console.log("Doctor user info retrieved");
            return res.json({
                user: selectUserResult[0],
                profile: selectDoctorResult[0]
            });
        }

        if (selectUserResult[0].role === 'patient') {
            const selectPatientSql = "SELECT * FROM patients WHERE user_id = ?";
            const [selectPatientResult,] = await db.query(selectPatientSql, [req.user.id]);
            console.log("Patient user info retrieved");
            return res.json({
                user: selectUserResult[0],
                profile: selectPatientResult[0]
            });
        }
    } catch (error) {
        console.log("Failed to retrieve user info", error);
        return res.status(401).json({ message: "Chưa đăng nhập" });
    }
});

app.get('/doctors', async (req, res) => {
    console.log("Get doctors request received");
    try {
        const selectDoctorsSql = "SELECT * FROM doctors";
        const [doctors,] = await db.query(selectDoctorsSql);

        console.log("Doctors retrieved", doctors);
        return res.json(doctors);
    } catch (error) {
        console.log("Failed to retrieve doctors", error);
        return res.status(500).json({ message: "Có lỗi xảy ra. Vui lòng thử lại" });
    }
});

app.post('/doctors', async (req, res) => {
    console.log("Add doctor request received", req.body);
    const { user_id, fullname, phone, address, gender, birth_year, specialty } = req.body;
    try {
        const insertDoctorSql = 'INSERT INTO doctors (user_id, fullname, phone, address, gender, birth_year, specialty, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())';
        await db.execute(insertDoctorSql, [user_id, fullname, phone, address, gender, birth_year, specialty]);

        console.log("Doctor added successfully");
        return res.status(200).json({ message: "Doctor added successfully" });
    } catch (error) {
        console.log("Failed to add doctor", error);
        return res.status(500).json({ message: "An error occurred while adding the doctor" });
    }
});

// API to update an existing doctor
app.put('/doctors/:id', async (req, res) => {
    console.log("Update doctor request received", req.body);
    const { id } = req.params;
    const { user_id, fullname, phone, address, gender, birth_year, specialty } = req.body;
    try {
        const updateDoctorSql = 'UPDATE doctors SET user_id = ?, fullname = ?, phone = ?, address = ?, gender = ?, birth_year = ?, specialty = ? WHERE id = ?';
        await db.execute(updateDoctorSql, [user_id, fullname, phone, address, gender, birth_year, specialty, id]);

        console.log("Doctor updated successfully");
        return res.status(200).json({ message: "Doctor updated successfully" });
    } catch (error) {
        console.log("Failed to update doctor", error);
        return res.status(500).json({ message: "An error occurred while updating the doctor" });
    }
});

// API to delete a doctor
app.delete('/doctors/:id', async (req, res) => {
    console.log("Delete doctor request received", req.params);
    const { id } = req.params;
    try {
        const deleteDoctorSql = 'DELETE FROM doctors WHERE id = ?';
        await db.execute(deleteDoctorSql, [id]);

        console.log("Doctor deleted successfully");
        return res.status(200).json({ message: "Doctor deleted successfully" });
    } catch (error) {
        console.log("Failed to delete doctor", error);
        return res.status(500).json({ message: "An error occurred while deleting the doctor" });
    }
});

app.post('/book-appointment', async (req, res) => {
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
});

app.get('/appointments', async (req, res) => {
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
});

// API to get the list of users
app.get('/users', async (req, res) => {
    console.log("Get users request received");
    try {
        const selectUsersSql = `
            SELECT
                u.id,
                u.username,
                u.role,
                u.status,
                u.created_at,
                p.fullname,
                p.phone,
                p.address,
                p.gender,
                p.birth_year
            FROM
                patients p
                    LEFT JOIN
                users u ON p.user_id = u.id
        `;
        const [users,] = await db.query(selectUsersSql);

        console.log("Users retrieved", users);
        return res.json(users);
    } catch (error) {
        console.log("Failed to retrieve users", error);
        return res.status(500).json({ message: "An error occurred while fetching the users" });
    }
});

// API to add a new user
app.post('/users', async (req, res) => {
    console.log("Add user request received", req.body);
    const { username, password, role, status } = req.body;
    try {
        const hashedPassword = bcrypt.hashSync(password, 10);
        const insertUserSql = 'INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)';
        await db.execute(insertUserSql, [username, hashedPassword, role, status]);

        console.log("User added successfully");
        return res.status(200).json({ message: "User added successfully" });
    } catch (error) {
        console.log("Failed to add user", error);
        return res.status(500).json({ message: "An error occurred while adding the user" });
    }
});

// API to update an existing user
const updateUser = (req, res) => {
    const { fullname, username, phone, address, gender, birth_year } = req.body;
    const { id } = req.params;
    console.log('Updating user with data:', { fullname, username, phone, address, gender, birth_year });

    updateUserInDB(id, { fullname, username, phone, address, gender, birth_year })
        .then(() => res.status(200).send('User updated successfully'))
        .catch(error => res.status(500).send(`Failed to update user: ${error.message}`));
};

app.put('/users/:id', updateUser);

const updateUserInDB = async (id, { fullname, username, phone, address, gender, birth_year }) => {
    const updateUserSql = 'UPDATE users SET username = ? WHERE id = ?';
    const updatePatientSql = 'UPDATE patients SET fullname = ?, phone = ?, address = ?, gender = ?, birth_year = ? WHERE user_id = ?';

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        await connection.execute(updateUserSql, [username, id]);
        await connection.execute(updatePatientSql, [fullname, phone, address, gender, birth_year, id]);
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

// API to delete a user
app.delete('/users/:id', async (req, res) => {
    console.log("Delete user request received", req.params);
    const { id } = req.params;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const deleteUserSql = 'DELETE FROM users WHERE id = ?';
        const deletePatientSql = 'DELETE FROM patients WHERE user_id = ?';
        await connection.execute(deleteUserSql, [id]);
        await connection.execute(deletePatientSql, [id]);
        await connection.commit();

        console.log("User deleted successfully");
        return res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
        await connection.rollback();
        console.log("Failed to delete user", error);
        return res.status(500).json({ message: "An error occurred while deleting the user" });
    } finally {
        connection.release();
    }
});

// API to add a new appointment
app.post('/hour_appointments', async (req, res) => {
    console.log("Add appointment request received", req.body);
    const { doctor_id, appointment_date, appointment_hour, patient_name, patient_phone, patient_address, patient_gender, patient_birth_year, appointment_reason } = req.body;
    try {
        const insertAppointmentSql = 'INSERT INTO hour_appointments (doctor_id, appointment_date, appointment_hour, patient_name, patient_phone, patient_address, patient_gender, patient_birth_year, appointment_reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())';
        await db.execute(insertAppointmentSql, [doctor_id, appointment_date, appointment_hour, patient_name, patient_phone, patient_address, patient_gender, patient_birth_year, appointment_reason]);

        console.log("Appointment added successfully");
        return res.status(200).json({ message: "Appointment added successfully" });
    } catch (error) {
        console.log("Failed to add appointment", error);
        return res.status(500).json({ message: "An error occurred while adding the appointment" });
    }
});

// API to update an existing appointment
app.put('/hour_appointments/:id', async (req, res) => {
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
});

// API to delete an appointment
app.delete('/hour_appointments/:id', async (req, res) => {
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
});

// API to add a new specialty
app.post('/specialties', async (req, res) => {
    console.log("Add specialty request received", req.body);
    const { name, description } = req.body;
    try {
        const insertSpecialtySql = 'INSERT INTO specialties (name, description, created_at) VALUES (?, ?, NOW())';
        await db.execute(insertSpecialtySql, [name, description]);

        console.log("Specialty added successfully");
        return res.status(200).json({ message: "Specialty added successfully" });
    } catch (error) {
        console.log("Failed to add specialty", error);
        return res.status(500).json({ message: "An error occurred while adding the specialty" });
    }
});

// API to update an existing specialty
app.put('/specialties/:id', async (req, res) => {
    console.log("Update specialty request received", req.body);
    const { id } = req.params;
    const { name, description } = req.body;
    try {
        const updateSpecialtySql = 'UPDATE specialties SET name = ?, description = ? WHERE id = ?';
        await db.execute(updateSpecialtySql, [name, description, id]);

        console.log("Specialty updated successfully");
        return res.status(200).json({ message: "Specialty updated successfully" });
    } catch (error) {
        console.log("Failed to update specialty", error);
        return res.status(500).json({ message: "An error occurred while updating the specialty" });
    }
});

// API to delete a specialty
app.delete('/specialties/:id', async (req, res) => {
    console.log("Delete specialty request received", req.params);
    const { id } = req.params;
    try {
        const deleteSpecialtySql = 'DELETE FROM specialties WHERE id = ?';
        await db.execute(deleteSpecialtySql, [id]);

        console.log("Specialty deleted successfully");
        return res.status(200).json({ message: "Specialty deleted successfully" });
    } catch (error) {
        console.log("Failed to delete specialty", error);
        return res.status(500).json({ message: "An error occurred while deleting the specialty" });
    }
});

// Khởi động server và lắng nghe các yêu cầu trên cổng 8080
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}...`);
});