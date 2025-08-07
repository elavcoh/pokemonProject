// favorites management routes for pokemon
// handles adding, removing, and retrieving user's favorite pokemon

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const USERS_FILE = path.join(__dirname, '..', 'Data', 'users.json');

// read users from file
function readUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

// write users to file
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// get user's favorites
router.get('/', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'not logged in' });

  const users = readUsers();
  const user = users.find(u => u.email === req.session.user.email);

  if (!user) return res.status(404).json({ error: 'user not found' });

  res.json({ favorites: Array.isArray(user.favorites) ? user.favorites : [] });
});

// add pokemon to user's favorites
router.post('/', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'not logged in' });

  const users = readUsers();
  const user = users.find(u => u.email === req.session.user.email);
  if (!user) return res.status(404).json({ error: 'user not found' });

  const { id, name, image, types, abilities, stats } = req.body;
  if (!id || !name || !image) {
    return res.status(400).json({ error: 'missing favorite data' });
  }

  if (!Array.isArray(user.favorites)) {
    user.favorites = [];
  }

  const alreadyExists = user.favorites.some(fav => parseInt(fav.id) === parseInt(id));

  if (alreadyExists) {
    return res.status(200).json({ success: true, favorites: user.favorites });
  }

  if (user.favorites.length >= 10) {
    return res.status(400).json({ error: 'you can only have up to 10 favorite pokemon' });
  }

  user.favorites.push({ id, name, image, types, abilities, stats });
  writeUsers(users);

  return res.status(200).json({ success: true, favorites: user.favorites });
});


// remove pokemon from user's favorites
router.post('/remove', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'not logged in' });

  const users = readUsers();
  const user = users.find(u => u.email === req.session.user.email);

  if (!user) return res.status(404).json({ error: 'user not found' });

  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'missing id' });

  const normalizedId = parseInt(id);

  if (Array.isArray(user.favorites)) {
    user.favorites = user.favorites.filter(fav => parseInt(fav.id) !== normalizedId);
    writeUsers(users); // save file after update
  }

  res.json({ success: true, favorites: user.favorites });
});

module.exports = router;
