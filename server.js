// main server for pokemon battle app
// handles users, battles, leaderboards, file serving

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const session = require('express-session');

const app  = express();
const PORT = 3000;

// parse request body data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());



// setup user sessions for login tracking
app.use(session({
  secret: 'myDevSecret123!',
  resave: true,
  saveUninitialized: true,
  cookie: {
    secure: false, // set to true in production with https
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// import api route handlers
const authRoutes  = require('./routes/auth');      // /login, /register, /logout
const usersRouter = require('./routes/users');     // /api/users
const favRoutes   = require('./routes/favorites'); // /api/favorites

// check if user logged in - return user info or error
app.get('/api/me', (req, res) => {
  console.log('api /me check:', {
    sessionId: req.sessionID,
    hasUser: !!req.session.user,
    user: req.session.user
  });
  
  if (!req.session.user) 
    return res.status(401).json({ error: 'not logged in' });
  res.json({
    email: req.session.user.email,
    firstName: req.session.user.firstName
  });
});

// get list of online users for battle matching
app.get('/api/online-users', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'not logged in' });
  
  const USERS_FILE = path.join(__dirname, 'Data', 'users.json');
  let users = [];
  try {
    users = JSON.parse(fs.readFileSync(USERS_FILE));
  } catch (e) {
    return res.status(500).json({ error: 'failed to read users file' });
  }
  
  // filter users who are online and active in last 5 minutes
  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
  
  // auto cleanup - mark users offline if no activity for 5 minutes
  let needsUpdate = false;
  users.forEach(user => {
    if (user.online && user.lastSeen && user.lastSeen < fiveMinutesAgo) {
      user.online = false;
      needsUpdate = true;
    }
  });
  
  // save updated users if any were marked offline
  if (needsUpdate) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  }
  
  const onlineUsers = users.filter(u => 
    u.online && 
    u.email !== req.session.user.email &&
    u.lastSeen && 
    u.lastSeen > fiveMinutesAgo
  );
  
  res.json({ online: onlineUsers });
});



// mount api routes
app.use('/',              authRoutes);
app.use('/api/users',     usersRouter);
app.use('/api/favorites', favRoutes);

// get leaderboard with player stats
app.get('/api/leaderboard', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'not logged in' });

  const USERS_FILE = path.join(__dirname, 'Data', 'users.json');
  const BATTLES_FILE = path.join(__dirname, 'Data', 'battles.json');
  
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    let battles = [];
    
    if (fs.existsSync(BATTLES_FILE)) {
      battles = JSON.parse(fs.readFileSync(BATTLES_FILE));
    }

    const playerStats = users.map(user => {
      const userBattles = battles.filter(battle => 
        battle.player1Id === user.id || battle.player2Id === user.id
      );

      let wins = 0, losses = 0, ties = 0;
      userBattles.forEach(battle => {
        if (battle.winner === user.id) wins++;
        else if (battle.winner === 'tie') ties++;
        else losses++;
      });

      const totalBattles = wins + losses + ties;
      return {
        id: user.id,
        firstName: user.firstName,
        email: user.email,
        wins, losses, ties, totalBattles,
        totalScore: (wins * 3) + (ties * 1),
        isCurrentUser: user.email === req.session.user.email
      };
    });

    const qualifiedPlayers = playerStats
      .filter(player => player.totalBattles >= 5)
      .sort((a, b) => b.totalScore - a.totalScore);

    res.json({ players: qualifiedPlayers });
  } catch (error) {
    console.error('Error calculating leaderboard:', error);
    res.status(500).json({ error: 'Failed to calculate leaderboard' });
  }
});

// function to check daily battle limit
function checkDailyBattleLimit(userId) {
  const USERS_FILE = path.join(__dirname, 'Data', 'users.json');
  let users = JSON.parse(fs.readFileSync(USERS_FILE));
  const user = users.find(u => u.id === userId);
  
  if (!user) return { canBattle: false, error: 'User not found' };
  
  // check if it's a new day (without updating the file)
  let currentDailyBattles = user.dailyBattles || 0;
  
  // check if user can battle
  if (currentDailyBattles >= 5) {
    return { 
      canBattle: false, 
      error: 'Daily battle limit reached (5 battles per day). Limit resets at midnight.',
      battlesUsed: currentDailyBattles,
      battlesRemaining: 0
    };
  }
  
  return { 
    canBattle: true, 
    battlesUsed: currentDailyBattles,
    battlesRemaining: 5 - currentDailyBattles
  };
}

// function to increment battle count
function incrementDailyBattles(userId) {
  const USERS_FILE = path.join(__dirname, 'Data', 'users.json');
  let users = JSON.parse(fs.readFileSync(USERS_FILE));
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex === -1) {
    console.log('User not found for incrementDailyBattles:', userId);
    return false;
  }
  
  console.log('Incrementing battles for user:', users[userIndex].firstName);
  console.log('Current dailyBattles:', users[userIndex].dailyBattles);
  
  // add battle
  users[userIndex].dailyBattles = (users[userIndex].dailyBattles || 0) + 1;
  console.log('New dailyBattles count:', users[userIndex].dailyBattles);
  
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  console.log('File updated successfully');
  return true;
}

// function to reset battles at midnight
function resetDailyBattles() {
  const USERS_FILE = path.join(__dirname, 'Data', 'users.json');
  let users = JSON.parse(fs.readFileSync(USERS_FILE));
  
  let updated = false;
  users.forEach(user => {
    if (user.dailyBattles > 0) {
      user.dailyBattles = 0;
      updated = true;
      console.log(`Reset battles for user: ${user.firstName}`);
    }
  });
  
  if (updated) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    console.log('Daily battles reset at midnight');
  }
}

// set up automatic midnight reset
function scheduleMidnightReset() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  const timeUntilMidnight = midnight.getTime() - now.getTime();
  
  console.log(`Scheduling midnight reset in ${Math.round(timeUntilMidnight / 1000 / 60)} minutes`);
  
  setTimeout(() => {
    resetDailyBattles();
    // schedule the next reset
    scheduleMidnightReset();
  }, timeUntilMidnight);
}

// start the automatic reset
scheduleMidnightReset();

// manual path for resetting battles (for testing)
app.get('/reset-daily-battles', (req, res) => {
  resetDailyBattles();
  res.json({ message: 'Daily battles reset manually' });
});

// api endpoint for battle limit check
app.get('/api/battle-limit', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'not logged in' });
  
  console.log('Checking battle limit for user:', req.session.user.firstName);
  console.log('User ID:', req.session.user.id);
  const limitInfo = checkDailyBattleLimit(req.session.user.id);
  console.log('Battle limit info:', limitInfo);
  res.json(limitInfo);
});

// battle api - player vs player
app.post('/api/arena/battle', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'not logged in' });

  console.log('Battle request from user:', req.session.user.firstName);

  // check daily battle limit
  const limitCheck = checkDailyBattleLimit(req.session.user.id);
  console.log('Battle limit check result:', limitCheck);
  
  if (!limitCheck.canBattle) {
    console.log('Battle blocked due to limit');
    return res.status(429).json({ error: limitCheck.error });
  }

  console.log('Battle allowed, proceeding...');

  const { opponentId } = req.body;
  const USERS_FILE = path.join(__dirname, 'Data', 'users.json');
  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  
  const me = users.find(u => u.email === req.session.user.email);
  const opp = users.find(u => u.id === opponentId);
  console.log('Current user email:', req.session.user.email);
  console.log('Current user favorites:', me ? me.favorites.length : 'N/A');
  console.log('Opponent found:', !!opp);
  console.log('Opponent favorites:', opp ? opp.favorites.length : 'N/A');

  if (!me) {
    console.log('Current user not found');
    return res.status(400).json({ error: 'Current user not found' });
  }
  if (!opp) {
    console.log('Opponent not found');
    return res.status(400).json({ error: 'Opponent not found' });
  }
  if (!me.favorites.length || !opp.favorites.length) {
    console.log('Missing favorites - me:', me.favorites.length, 'opp:', opp.favorites.length);
    return res.status(400).json({ error: 'Both players must have favorites' });
  }

  // select random pokemon for each player
  const mePokemon = me.favorites[Math.floor(Math.random() * me.favorites.length)];
  const oppPokemon = opp.favorites[Math.floor(Math.random() * opp.favorites.length)];

  console.log('Selected Pokémon - me:', mePokemon.name, 'opp:', oppPokemon.name);

  // calculate score based on formula: HP×0.3 + Attack×0.4 + Defense×0.2 + Speed×0.1
  function score(p) {
    const baseScore = p.stats.hp * 0.3 + p.stats.attack * 0.4 + p.stats.defense * 0.2 + p.stats.speed * 0.1;
    const randomBonus = Math.random() * 5; // small random component
    return baseScore + randomBonus;
  }

  const meScore = score(mePokemon);
  const oppScore = score(oppPokemon);

  console.log('Scores - me:', meScore, 'opp:', oppScore);

  // determine winner
  let winner;
  if (meScore > oppScore) winner = me.id;
  else if (oppScore > meScore) winner = opp.id;
  else winner = Math.random() < 0.5 ? me.id : opp.id;

  const battleResult = {
    me: {
      id: me.id,
      name: me.firstName,
      pokemon: mePokemon,
      score: Math.round(meScore * 100) / 100
    },
    opponent: {
      id: opp.id,
      name: opp.firstName,
      pokemon: oppPokemon,
      score: Math.round(oppScore * 100) / 100
    },
    meAllPokemons: me.favorites, // all of current player's pokemons
    oppAllPokemons: opp.favorites, // all of opponent's pokemons
    winner: winner,
    winnerName: winner === me.id ? me.firstName : opp.firstName
  };

  // increment daily battle count
  console.log('Incrementing daily battles for user:', req.session.user.id);
  incrementDailyBattles(req.session.user.id);

  // save battle to battles.json for leaderboard tracking
  const BATTLES_FILE = path.join(__dirname, 'Data', 'battles.json');
  let battles = [];
  
  if (fs.existsSync(BATTLES_FILE)) {
    battles = JSON.parse(fs.readFileSync(BATTLES_FILE));
  }

  const battleRecord = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    player1Id: me.id,
    player1Name: me.firstName,
    player1Pokemon: mePokemon.name,
    player1Score: Math.round(meScore * 100) / 100,
    player2Id: opp.id,
    player2Name: opp.firstName,
    player2Pokemon: oppPokemon.name,
    player2Score: Math.round(oppScore * 100) / 100,
    winner: winner,
    winnerName: winner === me.id ? me.firstName : opp.firstName
  };

  battles.push(battleRecord);
  fs.writeFileSync(BATTLES_FILE, JSON.stringify(battles, null, 2));

  // save to battle history for individual users
  const BATTLE_HISTORY_FILE = path.join(__dirname, 'Data', 'battle-history.json');
  let battleHistory = [];
  
  if (fs.existsSync(BATTLE_HISTORY_FILE)) {
    battleHistory = JSON.parse(fs.readFileSync(BATTLE_HISTORY_FILE));
  }

  // save for current player
  const playerBattleRecord = {
    id: Date.now().toString(),
    playerId: me.id,
    playerEmail: me.email,
    timestamp: Date.now(),
    type: 'vs-player',
    result: winner === me.id ? 'won' : 'lost',
    playerPokemon: mePokemon,
    opponentPokemon: oppPokemon,
    playerScore: Math.round(meScore * 100) / 100,
    opponentScore: Math.round(oppScore * 100) / 100,
    opponentName: opp.firstName
  };

  battleHistory.push(playerBattleRecord);
  fs.writeFileSync(BATTLE_HISTORY_FILE, JSON.stringify(battleHistory, null, 2));

  console.log('Battle result:', battleResult);
  console.log('Battle saved to history');
  res.json(battleResult);
});

// bot battle
app.post('/api/arena/bot-battle', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'not logged in' });
  
  console.log('Bot battle request from user:', req.session.user.firstName);
  
  // check daily battle limit
  const limitCheck = checkDailyBattleLimit(req.session.user.id);
  console.log('Bot battle limit check result:', limitCheck);
  
  if (!limitCheck.canBattle) {
    console.log('Bot battle blocked due to limit');
    return res.status(429).json({ error: limitCheck.error });
  }
  
  console.log('Bot battle allowed, proceeding...');
  
  try {
    const { playerPokemon, botPokemon, playerScore, botScore, winner } = req.body;
    
    // increment daily battle count
    console.log('Incrementing daily battles for bot battle user:', req.session.user.id);
    incrementDailyBattles(req.session.user.id);
    
    // save to battles.json for consistency
    const BATTLES_FILE = path.join(__dirname, 'Data', 'battles.json');
    let battles = [];
    
    if (fs.existsSync(BATTLES_FILE)) {
      battles = JSON.parse(fs.readFileSync(BATTLES_FILE));
    }

    const battleRecord = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      player1Id: req.session.user.id,
      player1Name: req.session.user.firstName,
      player1Pokemon: playerPokemon.name,
      player1Score: Math.round(playerScore * 100) / 100,
      player2Id: 'bot',
      player2Name: 'Bot',
      player2Pokemon: botPokemon.name,
      player2Score: Math.round(botScore * 100) / 100,
      winner: winner === 'player' ? req.session.user.id : winner === 'bot' ? 'bot' : 'tie'
    };

    battles.push(battleRecord);
    fs.writeFileSync(BATTLES_FILE, JSON.stringify(battles, null, 2));

    console.log('Bot battle saved to battles.json');
    res.json({ success: true, battleId: battleRecord.id });
  } catch (error) {
    console.error('Error saving bot battle result:', error);
    res.status(500).json({ error: 'Failed to save bot battle result' });
  }
});

// api endpoint for battle history
app.get('/api/battle-history', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'not logged in' });
  
  const BATTLE_HISTORY_FILE = path.join(__dirname, 'Data', 'battle-history.json');
  
  try {
    let battleHistory = [];
    if (fs.existsSync(BATTLE_HISTORY_FILE)) {
      battleHistory = JSON.parse(fs.readFileSync(BATTLE_HISTORY_FILE));
    }
    
    // filter battles for current user
    const userBattles = battleHistory.filter(battle => 
      battle.playerId === req.session.user.id || 
      battle.playerEmail === req.session.user.email
    );
    
    res.json({ battles: userBattles });
  } catch (error) {
    console.error('Error reading battle history:', error);
    res.status(500).json({ error: 'Failed to load battle history' });
  }
});

// api endpoint to save battle result
app.post('/api/save-battle', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'not logged in' });
  
  const BATTLE_HISTORY_FILE = path.join(__dirname, 'Data', 'battle-history.json');
  
  try {
    let battleHistory = [];
    if (fs.existsSync(BATTLE_HISTORY_FILE)) {
      battleHistory = JSON.parse(fs.readFileSync(BATTLE_HISTORY_FILE));
    }
    
    const battleData = {
      id: Date.now().toString(),
      playerId: req.session.user.id,
      playerEmail: req.session.user.email,
      timestamp: Date.now(),
      ...req.body
    };
    
    battleHistory.push(battleData);
    fs.writeFileSync(BATTLE_HISTORY_FILE, JSON.stringify(battleHistory, null, 2));
    
    res.json({ success: true, battleId: battleData.id });
  } catch (error) {
    console.error('Error saving battle:', error);
    res.status(500).json({ error: 'Failed to save battle' });
  }
});

// update login - add/update online field
app.post('/login', async (req, res) => {
  const USERS_FILE = path.join(__dirname, 'Data', 'users.json');
  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  const user = users.find(u => u.email === req.body.email);

  if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
    return res.status(401).render('login', { error: 'Invalid credentials' });
  }

  // update online status + login time
  const updatedUsers = users.map(u =>
    u.id === user.id
      ? { ...u, online: true, lastSeen: Date.now() }
      : (u.online === undefined ? { ...u, online: false } : u)
  );
  fs.writeFileSync(USERS_FILE, JSON.stringify(updatedUsers, null, 2));

  req.session.user = { id: user.id, email: user.email, firstName: user.firstName };
  res.redirect('/arena');
});

// update logout - set online to false
app.post('/logout', (req, res) => {
  if (req.session.user) {
    const USERS_FILE = path.join(__dirname, 'Data', 'users.json');
    let users = JSON.parse(fs.readFileSync(USERS_FILE));
    users = users.map(u => 
      u.id === req.session.user.id ? { ...u, online: false } : u
    );
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  }
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// update online status
app.post('/api/online', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'not logged in' });
  
  const USERS_FILE = path.join(__dirname, 'Data', 'users.json');
  let users = JSON.parse(fs.readFileSync(USERS_FILE));
  users = users.map(u => 
    u.id === req.session.user.id 
      ? { ...u, online: true, lastSeen: Date.now() } 
      : u
  );
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  res.json({ success: true });
});

// mark user as offline
app.post('/api/offline', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'not logged in' });
  
  const USERS_FILE = path.join(__dirname, 'Data', 'users.json');
  let users = JSON.parse(fs.readFileSync(USERS_FILE));
  users = users.map(u => 
    u.id === req.session.user.id 
      ? { ...u, online: false, lastSeen: Date.now() } 
      : u
  );
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  res.json({ success: true });
});

// manual user cleanup
app.get('/cleanup', (req, res) => {
  const USERS_FILE = path.join(__dirname, 'Data', 'users.json');
  let users = JSON.parse(fs.readFileSync(USERS_FILE));
  users = users.map(u => ({ ...u, online: false }));
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  res.json({ message: 'All users set to offline' });
});

// path for converting existing battles to personal history
app.get('/convert-battles-to-history', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'not logged in' });
  
  const BATTLES_FILE = path.join(__dirname, 'Data', 'battles.json');
  const BATTLE_HISTORY_FILE = path.join(__dirname, 'Data', 'battle-history.json');
  
  try {
    // read existing battles
    let battles = [];
    if (fs.existsSync(BATTLES_FILE)) {
      battles = JSON.parse(fs.readFileSync(BATTLES_FILE));
    }
    
    // read existing history
    let battleHistory = [];
    if (fs.existsSync(BATTLE_HISTORY_FILE)) {
      battleHistory = JSON.parse(fs.readFileSync(BATTLE_HISTORY_FILE));
    }
    
    let convertedCount = 0;
    
    // convert battles to current user's history
    battles.forEach(battle => {
      // check if current user participated in the battle
      if (battle.player1Id === req.session.user.id || battle.player2Id === req.session.user.id) {
        
        // check if battle already exists in history
        const exists = battleHistory.find(h => h.originalBattleId === battle.id);
        if (!exists) {
          
          // determine result
          let result = 'lost';
          if (battle.winner === req.session.user.id) {
            result = 'won';
          } else if (battle.winner === 'tie') {
            result = 'tie';
          }
          
          // determine battle type (vs-player or vs-bot)
          const isBot = battle.player2Name === 'Bot' || battle.player1Name === 'Bot';
          const type = isBot ? 'vs-bot' : 'vs-player';
          
          // create history record
          const historyRecord = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            originalBattleId: battle.id,
            playerId: req.session.user.id,
            playerEmail: req.session.user.email,
            timestamp: new Date(battle.timestamp).getTime(),
            type: type,
            result: result,
            playerPokemon: {
              name: battle.player1Id === req.session.user.id ? battle.player1Pokemon : battle.player2Pokemon,
              image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${Math.floor(Math.random() * 898) + 1}.png`,
              stats: {
                hp: Math.floor(Math.random() * 100) + 30,
                attack: Math.floor(Math.random() * 100) + 30,
                defense: Math.floor(Math.random() * 100) + 30,
                speed: Math.floor(Math.random() * 100) + 30
              }
            },
            opponentPokemon: {
              name: battle.player1Id === req.session.user.id ? battle.player2Pokemon : battle.player1Pokemon,
              image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${Math.floor(Math.random() * 898) + 1}.png`,
              stats: {
                hp: Math.floor(Math.random() * 100) + 30,
                attack: Math.floor(Math.random() * 100) + 30,
                defense: Math.floor(Math.random() * 100) + 30,
                speed: Math.floor(Math.random() * 100) + 30
              }
            },
            playerScore: battle.player1Id === req.session.user.id ? battle.player1Score : battle.player2Score,
            opponentScore: battle.player1Id === req.session.user.id ? battle.player2Score : battle.player1Score,
            opponentName: battle.player1Id === req.session.user.id ? battle.player2Name : battle.player1Name
          };
          
          battleHistory.push(historyRecord);
          convertedCount++;
        }
      }
    });
    
    // save updated history
    fs.writeFileSync(BATTLE_HISTORY_FILE, JSON.stringify(battleHistory, null, 2));
    
    res.json({ 
      success: true, 
      message: `Converted ${convertedCount} battles to personal history!`,
      totalBattles: battleHistory.length
    });
    
  } catch (error) {
    console.error('Error converting battles:', error);
    res.status(500).json({ error: 'Failed to convert battles' });
  }
  try {
    let battleHistory = [];
    if (fs.existsSync(BATTLE_HISTORY_FILE)) {
      battleHistory = JSON.parse(fs.readFileSync(BATTLE_HISTORY_FILE));
    }
    
    // create sample battles
    const sampleBattles = [
      {
        id: Date.now().toString(),
        playerId: req.session.user.id,
        playerEmail: req.session.user.email,
        timestamp: Date.now() - 86400000, // yesterday
        type: 'vs-bot',
        result: 'won',
        playerPokemon: {
          name: 'Pikachu',
          image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png',
          stats: { hp: 60, attack: 55, defense: 40, speed: 90 }
        },
        opponentPokemon: {
          name: 'Charmander',
          image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png',
          stats: { hp: 45, attack: 60, defense: 43, speed: 65 }
        },
        playerScore: 55.5,
        opponentScore: 52.8,
        opponentName: 'Bot'
      },
      {
        id: (Date.now() + 1).toString(),
        playerId: req.session.user.id,
        playerEmail: req.session.user.email,
        timestamp: Date.now() - 43200000, // 12 hours ago
        type: 'vs-player',
        result: 'lost',
        playerPokemon: {
          name: 'Bulbasaur',
          image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png',
          stats: { hp: 45, attack: 49, defense: 49, speed: 45 }
        },
        opponentPokemon: {
          name: 'Squirtle',
          image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png',
          stats: { hp: 44, attack: 48, defense: 65, speed: 43 }
        },
        playerScore: 47.0,
        opponentScore: 50.0,
        opponentName: 'Player2'
      },
      {
        id: (Date.now() + 2).toString(),
        playerId: req.session.user.id,
        playerEmail: req.session.user.email,
        timestamp: Date.now() - 3600000, // 1 hour ago
        type: 'vs-bot',
        result: 'won',
        playerPokemon: {
          name: 'Eevee',
          image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/133.png',
          stats: { hp: 55, attack: 55, defense: 50, speed: 55 }
        },
        opponentPokemon: {
          name: 'Rattata',
          image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/19.png',
          stats: { hp: 30, attack: 56, defense: 35, speed: 72 }
        },
        playerScore: 53.8,
        opponentScore: 48.3,
        opponentName: 'Bot'
      }
    ];
    
    battleHistory.push(...sampleBattles);
    fs.writeFileSync(BATTLE_HISTORY_FILE, JSON.stringify(battleHistory, null, 2));
    
    res.json({ success: true, message: 'Sample battles added!' });
  } catch (error) {
    console.error('Error adding sample battles:', error);
    res.status(500).json({ error: 'Failed to add sample battles' });
  }
});

// path for getting all battles with current user info
app.get('/api/all-battles', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'not logged in' });
  
  const BATTLES_FILE = path.join(__dirname, 'Data', 'battles.json');
  
  try {
    let battles = [];
    if (fs.existsSync(BATTLES_FILE)) {
      battles = JSON.parse(fs.readFileSync(BATTLES_FILE));
    }
    
    res.json({ 
      battles: battles,
      currentUser: {
        id: req.session.user.id,
        email: req.session.user.email,
        firstName: req.session.user.firstName
      }
    });
  } catch (error) {
    console.error('Error reading battles:', error);
    res.status(500).json({ error: 'Failed to load battles' });
  }
});

// check if user logged in - redirect to login if not
function requireLogin(req, res, next) {
  console.log('requireLogin check:', {
    path: req.path,
    hasUser: !!req.session.user,
    sessionId: req.sessionID,
    user: req.session.user
  });
  
  if (req.session.user)                           return next();
  if (req.path === '/login' || req.path === '/register') return next();
  return res.redirect('/login');
}

// 7) Serve any page under /arena (no “.html” in URL)
app.get('/arena/:page', requireLogin, (req, res, next) => {
  const filePath = path.join(__dirname, 'Client', 'arena', `${req.params.page}.html`);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  next();
});

// handle battle history page specifically
app.get('/arena/battle-history', requireLogin, (req, res) => {
  const filePath = path.join(__dirname, 'Client', 'arena', 'battle-history.html');
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  res.status(404).send('battle history page not found');
});

// 8) Serve root-level pages (no “.html” in URL)
app.get('/:page', requireLogin, (req, res, next) => {
  const filePath = path.join(__dirname, 'Client', `${req.params.page}.html`);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  next();
});

// homepage - always show homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'Client', 'homepage.html'));
});

// search page - requires login
app.get('/search', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'Client', 'index.html'));
});

// favorites page - requires login
app.get('/favorites', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'Client', 'favorites.html'));
});

// handle battle page without parameters in url
app.get('/arena/battle', requireLogin, (req, res) => {
  const filePath = path.join(__dirname, 'Client', 'arena', 'battle.html');
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  res.status(404).send('battle page not found');
});

// handle leaderboard page
app.get('/arena/leaderboard', requireLogin, (req, res) => {
  const filePath = path.join(__dirname, 'Client', 'arena', 'leaderboard.html');
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  res.status(404).send('leaderboard page not found');
});

// serve static files like css, js, images - but exclude .html files
app.use(express.static(path.join(__dirname, 'Client'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// path for sound files
app.use('/sounds', express.static(path.join(__dirname, 'Client', 'sounds')));

// start the server
app.listen(PORT, () => {
  console.log(`server running at http://localhost:${PORT}`);
});

