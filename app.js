require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const ExcelJS = require('exceljs');
const json2csv = require('json2csv').Parser;

const app = express();
const PORT = process.env.PORT || 10000;

// Database config
const pool = new Pool({
  host: process.env.DB_HOST || "database-1.crusmywccxmp.eu-north-1.rds.amazonaws.com",
  database: process.env.DB_NAME || "Garden",
  user: process.env.DB_USER || "postgresArr",
  password: process.env.DB_PASSWORD || "Aromal-11-2003",
  ssl: {
    rejectUnauthorized: false
  }
});

// Admin credentials
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD_HASH = bcrypt.hashSync("admin", 10);

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', __dirname + '/templates');

// Session middleware
app.use(session({
  secret: 'your_very_secure_secret_key_123!',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/templates/admin_login.html');
});

app.post('/admin', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    req.session.adminLoggedIn = true;
    return res.redirect('/admin/dashboard');
  }

  res.send('Invalid credentials');
});

app.get('/admin/dashboard', async (req, res) => {
  if (!req.session.adminLoggedIn) {
    return res.redirect('/admin');
  }

  try {
    // Test connection first
    await pool.query('SELECT 1');
    
    // Then query your table
    const { rows } = await pool.query('SELECT email, access_token FROM gtokens ORDER BY email');
    res.render('admin_dashboard', { tokens: rows });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).send(`Database error: ${err.message}`);
  }
});

// New route for downloading token data as Excel file
app.get('/admin/download/excel', async (req, res) => {
  if (!req.session.adminLoggedIn) {
    return res.redirect('/admin');
  }

  try {
    const { rows } = await pool.query('SELECT email, access_token FROM gtokens ORDER BY email');
    
    // Create a new Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Google Tokens');
    
    // Add columns
    worksheet.columns = [
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Access Token', key: 'access_token', width: 60 }
    ];
    
    // Add style to header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '3A7BD5' }  // Blue color matching your UI
    };
    worksheet.getRow(1).font = { color: { argb: 'FFFFFF' }, bold: true };
    
    // Add rows
    worksheet.addRows(rows);
    
    // Auto filter
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: rows.length + 1, column: 2 }
    };
    
    // Set content type and disposition
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=google_tokens.xlsx');
    
    // Write workbook to response
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (err) {
    console.error('Download error:', err.message);
    res.status(500).send(`Error generating Excel file: ${err.message}`);
  }
});

// Keep existing CSV and JSON routes if needed
app.get('/admin/download/csv', async (req, res) => {
  if (!req.session.adminLoggedIn) {
    return res.redirect('/admin');
  }

  try {
    const { rows } = await pool.query('SELECT email, access_token FROM gtokens ORDER BY email');
    
    // Convert to CSV
    const fields = ['email', 'access_token'];
    const json2csvParser = new json2csv({ fields });
    const csvData = json2csvParser.parse(rows);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=google_tokens.csv');
    res.status(200).end(csvData);
  } catch (err) {
    console.error('Download error:', err.message);
    res.status(500).send(`Error generating download: ${err.message}`);
  }
});

app.get('/admin/download/json', async (req, res) => {
  if (!req.session.adminLoggedIn) {
    return res.redirect('/admin');
  }

  try {
    const { rows } = await pool.query('SELECT email, access_token FROM gtokens ORDER BY email');
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=google_tokens.json');
    res.status(200).json(rows);
  } catch (err) {
    console.error('Download error:', err.message);
    res.status(500).send(`Error generating download: ${err.message}`);
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin');
});

app.listen(PORT, () => {
  console.log(`Admin panel running on port ${PORT}`);
});