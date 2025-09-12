// Import required modules
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config(); // Load environment variables from .env file

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("!!! ERROR: DATABASE_URL environment variable not set. !!!");
    process.exit(1);
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

// --- Express App Setup ---
const app = express();

// --- CORS Configuration ---
// Allow everything in development, restrict in production
const allowedOrigins = [
  "https://eventsphere-register.onrender.com", // deployed frontend
  "http://localhost:5500",                     // local testing
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true); // allow request
    } else {
      callback(new Error("CORS blocked: " + origin));
    }
  },
  optionsSuccessStatus: 200
}));

app.use(express.json());

// --- API Endpoints ---

// Register a new participant
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
    if (error.code === "23505") {
      // Unique violation error
      return res.status(400).json({ error: "This email is already registered." });
    }
    console.error('Registration Error:', error);
    res.status(500).json({ error: 'An error occurred during registration.' });
  }
});

// Get all participants
app.get('/participants', async (req, res) => {
  try {
    const query = 'SELECT registration_id, name, email, attended, timestamp, created_at FROM participants ORDER BY created_at DESC';
    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Fetch Participants Error:', error);
    res.status(500).json({ error: 'Failed to fetch participant data.' });
  }
});

// Check-in a participant
app.post('/checkin/:id', async (req, res) => {
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

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
