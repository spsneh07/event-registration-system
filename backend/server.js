// Import required modules
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const crypto = require('crypto');
const session = require('express-session');
const bcrypt = require('bcrypt');
require('dotenv').config();

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const connectionString = process.env.DATABASE_URL;

// Load from .env file
const {
    SESSION_SECRET,
    ADMIN_USERNAME,
    ADMIN_PASSWORD
} = process.env;

// --- Validations ---
if (!connectionString || !SESSION_SECRET || !ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.error("!!! FATAL ERROR: One or more required environment variables are not set. !!!");
    console.error("Please check DATABASE_URL, SESSION_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

const app = express();

// --- CORS Configuration ---
const allowedOrigins = [
    "https://eventsphere-register.onrender.com",
    "http://localhost:5500",
    "http://127.0.0.1:5500"
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("CORS blocked: " + origin));
        }
    },
    credentials: true // Allow cookies to be sent
}));

app.use(express.json());

// --- Session Middleware Setup ---
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// --- Hashing Admin Password (Run this once to get your hash) ---
// (async () => {
//   const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
//   console.log('Hashed Password for .env:', hashedPassword);
// })();

// --- Authentication Middleware ---
const authenticateAdmin = (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        return next(); // User is authenticated, proceed
    }
    res.status(401).json({ error: 'Unauthorized: Please log in.' });
};

// --- API Endpoints ---

// --- Auth Routes ---
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const isPasswordCorrect = await bcrypt.compare(password, ADMIN_PASSWORD);

    if (username === ADMIN_USERNAME && isPasswordCorrect) {
        req.session.isAdmin = true;
        res.status(200).json({ message: 'Login successful.' });
    } else {
        res.status(401).json({ error: 'Invalid username or password.' });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out.' });
        }
        res.clearCookie('connect.sid');
        res.status(200).json({ message: 'Logout successful.' });
    });
});

app.get('/session', authenticateAdmin, (req, res) => {
    // This route is protected. If it returns 200, the user has a valid session.
    res.status(200).json({ message: 'Session is active.' });
});

// --- Public Route ---
app.post('/register', async (req, res) => {
    const { name, email } = req.body;
    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required.' });
    }

    const registrationId = crypto.randomUUID();
    try {
        const query = 'INSERT INTO participants(registration_id, name, email) VALUES($1, $2, $3) RETURNING *';
        const values = [registrationId, name, email];
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === "23505") { // Unique violation for email
            return res.status(409).json({ error: "This email is already registered." });
        }
        console.error('Registration Error:', error);
        res.status(500).json({ error: 'An error occurred during registration.' });
    }
});


// --- Protected Admin Routes ---

app.get('/participants', authenticateAdmin, async (req, res) => {
    try {
        const query = 'SELECT registration_id, name, email, attended, timestamp FROM participants ORDER BY created_at DESC';
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Fetch Participants Error:', error);
        res.status(500).json({ error: 'Failed to fetch participant data.' });
    }
});

app.post('/checkin/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const findQuery = 'SELECT * FROM participants WHERE registration_id = $1';
        const findResult = await pool.query(findQuery, [id]);

        if (findResult.rows.length === 0) {
            return res.status(404).json({ error: 'Participant not found!' });
        }
        const participant = findResult.rows[0];
        if (participant.attended) {
            return res.status(409).json({ error: `${participant.name} is already checked in.` });
        }

        const updateQuery = 'UPDATE participants SET attended = TRUE, timestamp = NOW() WHERE registration_id = $1 RETURNING *';
        const updateResult = await pool.query(updateQuery, [id]);
        res.status(200).json({ message: `Welcome, ${updateResult.rows[0].name}! Check-in successful.` });
    } catch (error) {
        console.error('Check-in Error:', error);
        res.status(500).json({ error: 'An error occurred during check-in.' });
    }
});

app.get('/stats', authenticateAdmin, async (req, res) => {
    try {
        const statsQuery = `
            SELECT
                COUNT(*) AS total,
                COUNT(CASE WHEN attended = TRUE THEN 1 END) AS checked_in
            FROM participants
        `;
        const result = await pool.query(statsQuery);
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Fetch Stats Error:', error);
        res.status(500).json({ error: 'Failed to fetch stats.' });
    }
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
});