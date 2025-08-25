// server.js (Node.js)
const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const projects = [
  { title: 'Cloud Service', description: 'Scalable cloud solution', link: 'https://github.com/GMNBNBNB' },
  { title: 'Meal Search App', description: 'Search meals by ingredients', link: 'https://github.com/goestfish/Meal-Search' },
  { title: 'Book Management', description: 'Organize books efficiently', link: 'https://github.com/GMNBNBNB' }
];

app.get('/api/projects', (req, res) => res.json(projects));

// Configure transporter (example using Gmail SMTP)
const transporter = nodemailer.createTransport({
  service: 'Gmail', auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body;
  const mailOptions = {
    from: email,
    to: process.env.EMAIL_USER,
    subject: `New portfolio message from ${name}`,
    text: message
  };
  transporter.sendMail(mailOptions, (err, info) => {
    if (err) return res.status(500).json({ message: 'Email send failed.' });
    res.json({ message: 'Thanks! I will get back to you soon.' });
  });
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));