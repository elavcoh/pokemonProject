// user management routes for crud operations
// handles creating, reading, updating, and deleting user records

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const DATA_FILE = path.join(__dirname, '..', 'Data', 'users.json');

// read users from file
function readUsers() {
    if (!fs.existsSync(DATA_FILE)) return [];
    const data = fs.readFileSync(DATA_FILE);
    return JSON.parse(data);
}

// write users to file
function writeUsers(users) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
}

// create new user
router.post('/', (req, res) => {
    const newUser = {
        id: Date.now().toString(),
        name: req.body.name,
        email: req.body.email
    };

    const users = readUsers();
    users.push(newUser);
    writeUsers(users);

    res.send('user saved!');
});

// get all users
router.get('/', (req, res) => {
    const users = readUsers();
    res.json(users);
});

// get user by id
router.get('/:id', (req, res) => {
    const users = readUsers();
    const user = users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).send('user not found');
    res.json(user);
});

// update user by id
router.put('/:id', (req, res) => {
    const users = readUsers();
    const index = users.findIndex(u => u.id === req.params.id);
    if (index === -1) return res.status(404).send('user not found');

    users[index] = { ...users[index], ...req.body };
    writeUsers(users);
    res.send('user updated');
});

// delete user by id
router.delete('/:id', (req, res) => {
    let users = readUsers();
    const initialLength = users.length;
    users = users.filter(u => u.id !== req.params.id);

    if (users.length === initialLength) {
        return res.status(404).send('user not found');
    }

    writeUsers(users);
    res.send('user deleted');
});

module.exports = router;
