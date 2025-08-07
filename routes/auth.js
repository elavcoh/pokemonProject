// auth routes for user register, login, logout
// handles user validation, password hash, session stuff

const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

const USERS_FILE = path.join(__dirname, '..', 'Data', 'users.json');

// read users from file
function readUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  const data = fs.readFileSync(USERS_FILE, 'utf-8');
  return JSON.parse(data);
}

// write users to file
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// serve login and register pages
router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'Client', 'login.html'));
});

router.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'Client', 'register.html'));
});

// handle user registration
router.post('/register', async (req, res) => {
  const { firstName, email, password, confirmPassword } = req.body;
  const errors = [];

  // validate first name
  if (!firstName || !/^[A-Za-z]{1,50}$/.test(firstName)) {
    errors.push("first name must be up to 50 english letters only.");
  }

  // validate email
  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    errors.push("invalid email format.");
  }

  // validate password
  if (
    !password ||
    password.length < 7 ||
    password.length > 15 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^a-zA-Z0-9]/.test(password)
  ) {
    errors.push("password must be 7–15 characters with upper, lower, digit, and special character.");
  }

  // confirm passwords match
  if (password !== confirmPassword) {
    errors.push("passwords do not match.");
  }

  // check for existing email
  const users = readUsers();
  if (users.find(u => u.email === email)) {
    errors.push("email already registered.");
  }

  // if any errors, show them
  if (errors.length > 0) {
    const errorMessage = errors.join(' ');
    return res.redirect('/register?error=' + encodeURIComponent(errorMessage));
  }

  // all good - create user with id and favorites
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: uuidv4(),
    firstName,
    email,
    password: hashedPassword,
    favorites: []
  };

  users.push(newUser);
  writeUsers(users);

  res.redirect('/login');
});

// handle user login
router.post('/login', async (req, res) => {
  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  const user = users.find(u => u.email === req.body.email);

  // check password and stuff
  if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
    return res.redirect('/login?error=' + encodeURIComponent('invalid email or password!'));
  }

  // update/add online field
  const updatedUsers = users.map(u =>
    u.id === user.id
      ? { ...u, online: true }
      : (u.online === undefined ? { ...u, online: false } : u)
  );
  fs.writeFileSync(USERS_FILE, JSON.stringify(updatedUsers, null, 2));

  // save user to session
  req.session.user = { id: user.id, email: user.email, firstName: user.firstName };
  res.redirect('/search');
});

// handle user logout
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Logout failed');
    }
    res.redirect('/');
  });
});

module.exports = router;
