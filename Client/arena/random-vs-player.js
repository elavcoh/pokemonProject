// random vs player battle interface
// handles player vs player battles, online user management, battle animations

let battleData = null;
let currentUser = null;
let battleAudio = null; // global variable for battle sound

// load current user and set online status
async function loadCurrentUser() {
  try {
    console.log('loading current user...');
    const res = await fetch('/api/me');
    console.log('api response:', res);
    
    if (!res.ok) {
      throw new Error('failed to load user');
    }
    
    currentUser = await res.json();
    console.log('current user loaded:', currentUser);
    
    // update online status
    console.log('setting user online...');
    const onlineRes = await fetch('/api/online', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (onlineRes.ok) {
      console.log('user set to online');
    } else {
      console.log('failed to set user online');
    }
    
    await loadPlayers();
  } catch (error) {
    console.error('error loading user:', error);
  }
}

// load all online users for battle selection
async function loadPlayers() {
  const res = await fetch('/api/online-users');
  const data = await res.json();
  const list = document.getElementById('players-list');
  list.innerHTML = '';

  if (!data.online.length) {
    list.innerHTML = '<p class="no-players">no players online.</p>';
    return;
  }

  data.online.forEach(player => {
    if (player.id === currentUser.id) return;
    const div = document.createElement('div');
    div.className = 'player-card';
    div.innerHTML = `
      <h3>${player.firstName}</h3>
      <p>${player.email}</p>
      <p class="pokemon-count">pokemon: ${player.favorites ? player.favorites.length : 0}</p>
      <button class="challenge-btn">challenge</button>
    `;
    div.querySelector('.challenge-btn').onclick = () => startBattle(player.id);
    list.appendChild(div);
  });
}

// start battle with another player
async function startBattle(opponentId) {
  console.log('starting battle with opponent:', opponentId);
  
  // check battle limit before starting battle
  try {
    const limitRes = await fetch('/api/battle-limit');
    if (limitRes.ok) {
      const limitData = await limitRes.json();
      if (!limitData.canBattle) {
        alert(limitData.error);
        return;
      }
    }
  } catch (error) {
    console.error('error checking battle limit:', error);
  }
  
  try {
    const res = await fetch('/api/arena/battle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opponentId })
    });
    
    if (!res.ok) {
      const error = await res.json();
      console.error('battle error:', error);
      alert(error.error || 'failed to start battle');
      return;
    }
    
    battleData = await res.json();
    console.log('battle data received:', battleData);
    
    // reset previous state
    const startBtn = document.getElementById('start-battle-btn');
    const rematchBtn = document.getElementById('rematch-btn');
    const timer = document.getElementById('timer');
    
    // reset buttons
    startBtn.disabled = false;
    startBtn.style.display = 'inline-block';
    rematchBtn.style.display = 'none';
    
    // hide timer
    timer.style.display = 'none';
    
    // remove previous crowns and winner/loser classes
    const me = document.getElementById('me');
    const opp = document.getElementById('opp');
    if (me) {
      me.classList.remove('winner', 'loser');
      const crowns = me.querySelectorAll('.crown');
      crowns.forEach(crown => crown.remove());
    }
    if (opp) {
      opp.classList.remove('winner', 'loser');
      const crowns = opp.querySelectorAll('.crown');
      crowns.forEach(crown => crown.remove());
    }
    
    document.getElementById('players-section').style.display = 'none';
    document.getElementById('battle-section').style.display = 'block';
    renderBattle();
  } catch (err) {
    console.error('battle error:', err);
    alert('failed to start battle');
  }
}

// display battle: pokemon, stats, score
function renderBattle() {
  const field = document.getElementById('battle-field');
  const me = battleData.me, opp = battleData.opponent;
  field.innerHTML = `
    <div class="battle-pokemon" id="me">
      <div class="player-info">
        <h3>${me.name}</h3>
        <div class="pokemon-details">
          <img src="${me.pokemon.image}" alt="${me.pokemon.name}" class="pokemon-img"/>
          <h4>${me.pokemon.name}</h4>
          <div class="stats">
            <div class="stat">HP: ${me.pokemon.stats.hp}</div>
            <div class="stat">Attack: ${me.pokemon.stats.attack}</div>
            <div class="stat">Defense: ${me.pokemon.stats.defense}</div>
            <div class="stat">Speed: ${me.pokemon.stats.speed}</div>
          </div>
          <div class="score">Score: <b>${Math.round(me.score * 100) / 100}</b></div>
        </div>
      </div>
    </div>
    <div class="vs-divider">VS</div>
    <div class="battle-pokemon" id="opp">
      <div class="player-info">
        <h3>${opp.name}</h3>
        <div class="pokemon-details">
          <img src="${opp.pokemon.image}" alt="${opp.pokemon.name}" class="pokemon-img"/>
          <h4>${opp.pokemon.name}</h4>
          <div class="stats">
            <div class="stat">HP: ${opp.pokemon.stats.hp}</div>
            <div class="stat">Attack: ${opp.pokemon.stats.attack}</div>
            <div class="stat">Defense: ${opp.pokemon.stats.defense}</div>
            <div class="stat">Speed: ${opp.pokemon.stats.speed}</div>
          </div>
          <div class="score">Score: <b>${Math.round(opp.score * 100) / 100}</b></div>
        </div>
      </div>
    </div>
  `;
  
  // start pokemon roulette immediately
  animatePokemonRoulette();
}

function animatePokemonRoulette() {
  const mePokemons = battleData.meAllPokemons || [battleData.me.pokemon];
  const oppPokemons = battleData.oppAllPokemons || [battleData.opponent.pokemon];

  let meImg = document.querySelector('#me .pokemon-img');
  let meName = document.querySelector('#me h4');
  let oppImg = document.querySelector('#opp .pokemon-img');
  let oppName = document.querySelector('#opp h4');

  let totalDuration = 1800; // total duration in milliseconds
  let interval = 60; // fast start
  let elapsed = 0;

  // roulette effect: starts fast and slows down gradually
  function spin() {
    if (elapsed < totalDuration) {
      // randomly select pokemon for each side
      const mePoke = mePokemons[Math.floor(Math.random() * mePokemons.length)];
      const oppPoke = oppPokemons[Math.floor(Math.random() * oppPokemons.length)];
      if (meImg && meName) {
        meImg.src = mePoke.image;
        meName.textContent = mePoke.name;
        meImg.style.transform = 'scale(1.15)';
        setTimeout(() => meImg.style.transform = 'scale(1)', 40);
      }
      if (oppImg && oppName) {
        oppImg.src = oppPoke.image;
        oppName.textContent = oppPoke.name;
        oppImg.style.transform = 'scale(1.15)';
        setTimeout(() => oppImg.style.transform = 'scale(1)', 40);
      }
      // gradually decelerate
      interval = Math.min(200, interval + 15);
      elapsed += interval;
      setTimeout(spin, interval);
    } else {
      // at the end - return the pokemon that was actually selected
      if (meImg && meName) {
        meImg.src = battleData.me.pokemon.image;
        meName.textContent = battleData.me.pokemon.name;
        meImg.style.transform = 'scale(1)';
      }
      if (oppImg && oppName) {
        oppImg.src = battleData.opponent.pokemon.image;
        oppName.textContent = battleData.opponent.pokemon.name;
        oppImg.style.transform = 'scale(1)';
      }
    }
  }
  spin();
}

// timer 3...2...1 and then show winner
function runBattle() {
  const timer = document.getElementById('timer');
  const startBtn = document.getElementById('start-battle-btn');
  const rematchBtn = document.getElementById('rematch-btn');
  
  // reset UI
  startBtn.disabled = true;
  rematchBtn.style.display = 'none';
  
  // clear previous winner/loser classes
  const me = document.getElementById('me');
  const opp = document.getElementById('opp');
  me.classList.remove('winner', 'loser');
  opp.classList.remove('winner', 'loser');
  
  // remove previous crowns
  const crowns = document.querySelectorAll('.crown');
  crowns.forEach(crown => crown.remove());
  
  // create and play battle sound
  battleAudio = new Audio('/sounds/battle sound.mp3');
  battleAudio.volume = 0.3;
  battleAudio.play().catch(e => console.log('battle sound play failed:', e));
  
  let countdown = 3;
  timer.textContent = countdown;
  timer.style.display = 'block';
  
  const interval = setInterval(() => {
    countdown--;
    if (countdown === 0) {
      clearInterval(interval);
      timer.textContent = "Fight!";
      setTimeout(() => {
        timer.style.display = 'none';
        showWinner();
        // show rematch button after battle
        rematchBtn.style.display = 'inline-block';
        startBtn.style.display = 'none';
      }, 1000);
    } else {
      timer.textContent = countdown;
    }
  }, 1000);
}

// wire up the buttons
document.getElementById('start-battle-btn').onclick = runBattle;
document.getElementById('rematch-btn').onclick = startNewRandomBattle;
document.getElementById('refresh-players-btn').onclick = refreshPlayers;

// refresh players list
async function refreshPlayers() {
  console.log('refreshing players list...');
  const refreshBtn = document.getElementById('refresh-players-btn');
  
  // disable button and show loading state
  refreshBtn.disabled = true;
  refreshBtn.textContent = '🔄 refreshing...';
  
  try {
    // update current user's online status
    await fetch('/api/online', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    // reload players list
    await loadPlayers();
    
    console.log('players list refreshed successfully');
  } catch (error) {
    console.error('error refreshing players:', error);
  } finally {
    // re-enable button and restore text
    refreshBtn.disabled = false;
    refreshBtn.textContent = '🔄 refresh players';
  }
}

// new function to create a new random battle
async function startNewRandomBattle() {
  console.log('starting new random battle...');
  
  // check battle limit before starting battle
  try {
    const limitRes = await fetch('/api/battle-limit');
    if (limitRes.ok) {
      const limitData = await limitRes.json();
      if (!limitData.canBattle) {
        alert(limitData.error);
        return;
      }
    }
  } catch (error) {
    console.error('error checking battle limit:', error);
  }
  
  try {
    // get list of online players
    const res = await fetch('/api/online-users');
    const data = await res.json();
    
    if (!data.online || data.online.length === 0) {
      alert('no players available for battle. please try again.');
      return;
    }
    
    // select a random opponent
    const randomIndex = Math.floor(Math.random() * data.online.length);
    const randomPlayer = data.online[randomIndex];
    
    console.log('selected random opponent:', randomPlayer.firstName);
    
    // start a new battle with the random opponent
    await startBattle(randomPlayer.id);
    
  } catch (error) {
    console.error('error starting new random battle:', error);
    alert('failed to start new battle. please try again.');
  }
}

// display winner with crown and sound
function showWinner() {
  // stop battle sound immediately
  if (battleAudio) {
    battleAudio.pause();
    battleAudio.currentTime = 0;
    battleAudio = null;
  }
  
  const winnerId = battleData.winner;
  const me = document.getElementById('me');
  const opp = document.getElementById('opp');
  
  // play winner sound
  const audio = new Audio('/sounds/sound.wav');
  audio.play().catch(e => console.log('audio play failed:', e));
  
  if (battleData.me.id === winnerId) {
    me.classList.add('winner');
    opp.classList.add('loser');
    me.innerHTML += '<div class="crown">👑</div>';
  } else {
    opp.classList.add('winner');
    me.classList.add('loser');
    opp.innerHTML += '<div class="crown">👑</div>';
  }
}

// back button
document.getElementById('back-btn').onclick = () => {
  document.getElementById('players-section').style.display = 'block';
  document.getElementById('battle-section').style.display = 'none';
  // reset buttons when going back
  document.getElementById('start-battle-btn').disabled = false;
  document.getElementById('start-battle-btn').style.display = 'inline-block';
  document.getElementById('rematch-btn').style.display = 'none';
  // clear any winner/loser classes
  const me = document.getElementById('me');
  const opp = document.getElementById('opp');
  if (me) me.classList.remove('winner', 'loser');
  if (opp) opp.classList.remove('winner', 'loser');
  // remove crowns
  const crowns = document.querySelectorAll('.crown');
  crowns.forEach(crown => crown.remove());
};

// initialization
async function init() {
  await loadCurrentUser();
}

// run when the page loads
document.addEventListener('DOMContentLoaded', init); 