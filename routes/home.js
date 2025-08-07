// home page route handler
// serves welcome page with project info and developer list

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.get('/', (req, res) => {
  const filePath = path.join(__dirname, '..', 'Data', 'projectInfo.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  let html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Welcome</title>
    <link rel="stylesheet" href="/app/pokemon.css" />
  </head>
  <body>
    <h1>Welcome to the Pokémon App</h1>
    <h2>Project Description:</h2>
    <p>${data.description}</p>
    <h2>Developed by:</h2>
    <ul>
  `;

  data.students.forEach(student => {
    html += `<li>${student.name} - ${student.id}</li>`;
  });

  html += `
    </ul>
    <a href="/register">Register</a> | <a href="/login">Login</a>
  </body>
  </html>
  `;

  res.send(html);
});

module.exports = router;
