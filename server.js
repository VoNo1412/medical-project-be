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
    origin: 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Tạo kết nối đến cơ sở dữ liệu MySQL

let db = null;

async function connectDatabase() {
    db = await mysql.createConnection({
        host: process.env.DB_HOST || "103.221.222.62",
        user: process.env.DB_USER || "waghgljj_nhakhoauser",
        port: process.env.DB_PORT || 3306,
        password: process.env.DB_PASSWORD || "!pr9bTW8vmeLwHY",
        database: process.env.DB_NAME || "waghgljj_nhakhoa",
        timezone: '+07:00'
    });
    console.log("Database connected");
}

connectDatabase();

// Authentication middleware
function authMiddleware(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        console.log("No token provided");
        return res.status(401).json({ message: "Chưa đăng nhập" });
    }

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

            if (selectUserResult[0].role === 'admin') {
                console.log("Admin login successful");
                return res.json({ message: "Đăng nhập thành công", redirect: "/admin" });
            }

            if (selectUserResult[0].role === 'doctor') {
                console.log("Doctor login successful");
                return res.json({ message: "Đăng nhập thành công", redirect: "/doctor" });
            }

            if (selectUserResult[0].role === 'patient') {
                console.log("Patient login successful");
                return res.json({ message: "Đăng nhập thành công", redirect: "/" });
            }
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

// Khởi động server và lắng nghe các yêu cầu trên cổng 8080
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}...`);
});