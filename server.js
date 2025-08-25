// server.js (Node.js)
const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const projects = [
  { 
    title: 'Cloud Service Platform', 
    description: 'Scalable cloud-native solution with microservices architecture, featuring auto-scaling, monitoring, and CI/CD pipeline integration.',
    link: 'https://github.com/GMNBNBNB',
    tech: ['Node.js', 'AWS', 'Docker', 'MongoDB']
  },
  { 
    title: 'Meal Discovery App', 
    description: 'Interactive meal search application with ingredient-based filtering, nutritional information, and recipe recommendations.',
    link: 'https://github.com/goestfish/Meal-Search',
    tech: ['React', 'API Integration', 'CSS3']
  },
  { 
    title: 'Smart Book Manager', 
    description: 'Comprehensive book management system with advanced search, categorization, reading progress tracking, and social features.',
    link: 'https://github.com/GMNBNBNB',
    tech: ['Vue.js', 'Express', 'PostgreSQL']
  },
  {
    title: 'E-Commerce Dashboard',
    description: 'Modern admin dashboard for e-commerce platforms with real-time analytics, inventory management, and sales tracking.',
    link: 'https://github.com/GMNBNBNB',
    tech: ['React', 'TypeScript', 'Chart.js', 'REST API']
  },
  {
    title: 'Task Management Suite',
    description: 'Collaborative project management tool with team collaboration, time tracking, and automated workflow features.',
    link: 'https://github.com/GMNBNBNB',
    tech: ['Next.js', 'Prisma', 'WebSocket', 'Tailwind']
  },
  {
    title: 'Weather Analytics Platform',
    description: 'Advanced weather data visualization platform with predictive analytics, historical data analysis, and API integration.',
    link: 'https://github.com/GMNBNBNB',
    tech: ['Python', 'Flask', 'D3.js', 'Machine Learning']
  }
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
  
  // Basic validation
  if (!name || !email || !message) {
    return res.status(400).json({ message: 'All fields are required.' });
  }
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Please provide a valid email address.' });
  }
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    replyTo: email,
    subject: `Portfolio Contact: Message from ${name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">New Portfolio Message</h2>
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Message:</strong></p>
          <p style="background: white; padding: 15px; border-radius: 4px; border-left: 4px solid #6366f1;">${message}</p>
        </div>
        <p style="color: #64748b; font-size: 14px;">Sent from your portfolio website</p>
      </div>
    `
  };
  
  // If no email configuration, simulate success for demo
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Contact form submission:', { name, email, message });
    return res.json({ message: 'Thanks for your message! I\'ll get back to you soon.' });
  }
  
  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Email send error:', err);
      return res.status(500).json({ message: 'Failed to send message. Please try again later.' });
    }
    console.log('Email sent successfully:', info.messageId);
    res.json({ message: 'Thanks for your message! I\'ll get back to you soon.' });
  });
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));