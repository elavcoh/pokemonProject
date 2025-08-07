// battle page handler
// manages pokemon battle interface, user auth, battle logic

(async () => {
    // nav buttons for user flow
    document.getElementById('back-btn')
      .addEventListener('click', () => location.href = '/arena/vs-bot');
    document.getElementById('back-to-search-btn')
      .addEventListener('click', () => location.href = '/arena');
  
    // check user login and show name
    try {
      const me = await fetch('/api/me', { credentials: 'same-origin' });
      if (!me.ok) throw 0;
      const u = await me.json();
      document.getElementById('user-info').textContent = 'logged in as ' + u.firstName;
    } catch {
      return location.replace('/login');
    }
  
    // get pokemon ids from url params
    const playerId = sessionStorage.getItem('playerId');
    const botId = sessionStorage.getItem('botId');
    
    if (!playerId || !botId) {
      alert('missing pokemon ids. please try again.');
      history.back();
      return;
    }
    
    // fetch pokemon data from pokeapi
    async function getPokemon(id) {
      try {
        const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
        if (!r.ok) throw new Error(`failed to fetch pokemon ${id}`);
        return r.json();
      } catch (error) {
        console.error('error fetching pokemon:', error);
        alert(`failed to load pokemon ${id}. please try again.`);
        history.back();
        throw error;
      }
    }
    
    const [player, bot] = await Promise.all([
      getPokemon(playerId), getPokemon(botId)
    ]);
  
    // make pokemon cards with click to expand stats
    function renderCard(poke, id) {
      const el = document.getElementById(id);
      const stat = n => poke.stats.find(s=>s.stat.name===n).base_stat;
      el.innerHTML = `
        <h2>#${poke.id} - ${poke.name}</h2>
        <img src="${poke.sprites.front_default}" alt="${poke.name}" />
        <div class="details">
          <p><strong>hp:</strong> ${stat('hp')}</p>
          <p><strong>attack:</strong> ${stat('attack')}</p>
          <p><strong>defense:</strong> ${stat('defense')}</p>
          <p><strong>speed:</strong> ${stat('speed')}</p>
        </div>
      `;
      el.addEventListener('click', () => el.classList.toggle('expanded'));
    }
    renderCard(player, 'player-card');
    renderCard(bot,    'bot-card');
  
    // battle interface elements
    const fightBtn   = document.getElementById('fight-btn');
    const rematchBtn = document.getElementById('rematch-btn');
    const cdEl       = document.getElementById('countdown');
    const resEl      = document.getElementById('result');
    const pcEl       = document.getElementById('player-card');
    const bcEl       = document.getElementById('bot-card');
  
    // main battle function with countdown and scoring
    function runBattle() {
      // reset ui
      pcEl.classList.remove('winner','loser');
      bcEl.classList.remove('winner','loser');
      cdEl.textContent = '';
      resEl.textContent = '';

      // hide start -> show only rematch at end
      fightBtn.style.display   = 'none';
      rematchBtn.style.display = 'none';

      // compute scores
      const w = { hp:0.3, attack:0.4, defense:0.2, speed:0.1 };
      const statVal = (o,n) => {
        const stat = o.stats.find(s=>s.stat.name===n);
        return stat ? stat.base_stat : 0;
      };
      const rnd      = () => Math.random() * 10;
      const score    = p =>
        w.hp      * statVal(p,'hp') +
        w.attack  * statVal(p,'attack') +
        w.defense * statVal(p,'defense') +
        w.speed   * statVal(p,'speed') +
        rnd();

      const pScore = score(player), bScore = score(bot);
  
      // countdown 3…2…1…fight!
      let cnt = 3;
      cdEl.textContent = cnt;
      
      // Create and play battle sound
      const battleSound = new Audio('/sounds/battle sound.mp3');
      battleSound.volume = 0.3;
      battleSound.play().catch(e => console.log('battle sound play failed:', e));
      
      const iv = setInterval(() => {
        cnt--;
        if (cnt > 0) {
          cdEl.textContent = cnt;
        } else {
          clearInterval(iv);
          cdEl.textContent = 'fight!';
          
          // determine winner and highlight cards
          let result = 'tie';
          if (pScore > bScore) {
            pcEl.classList.add('winner');
            bcEl.classList.add('loser');
            resEl.textContent = 'you win!';
            result = 'won';
          } else if (bScore > pScore) {
            bcEl.classList.add('winner');
            pcEl.classList.add('loser');
            resEl.textContent = 'bot wins!';
            result = 'lost';
          } else {
            resEl.textContent = "it's a tie!";
            result = 'tie';
          }
          
          // save battle result to server
          saveBattleResult(player, bot, pScore, bScore, result);
          
          try {
            const sound = document.getElementById('battle-end-sound');
            if (sound) sound.play();
          } catch (error) {
            console.log('sound play failed:', error);
          }

          // show rematch button only
          rematchBtn.style.display = 'inline-block';
          
          // stop battle sound 2 seconds after winner is declared
          setTimeout(() => {
            battleSound.pause();
            battleSound.currentTime = 0;
          }, 2000);
        }
      }, 1000);
    }
    
    // save battle result to server
    async function saveBattleResult(player, bot, playerScore, botScore, result) {
      try {
        const response = await fetch('/api/arena/bot-battle', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            playerPokemon: {
              name: player.name,
              image: player.sprites.front_default,
              stats: {
                hp: player.stats.find(s => s.stat.name === 'hp').base_stat,
                attack: player.stats.find(s => s.stat.name === 'attack').base_stat,
                defense: player.stats.find(s => s.stat.name === 'defense').base_stat,
                speed: player.stats.find(s => s.stat.name === 'speed').base_stat
              }
            },
            botPokemon: {
              name: bot.name,
              image: bot.sprites.front_default,
              stats: {
                hp: bot.stats.find(s => s.stat.name === 'hp').base_stat,
                attack: bot.stats.find(s => s.stat.name === 'attack').base_stat,
                defense: bot.stats.find(s => s.stat.name === 'defense').base_stat,
                speed: bot.stats.find(s => s.stat.name === 'speed').base_stat
              }
            },
            playerScore: playerScore,
            botScore: botScore,
            winner: result === 'won' ? 'player' : result === 'lost' ? 'bot' : 'tie'
          })
        });
        
        if (response.ok) {
          console.log('battle result saved successfully');
        } else {
          console.error('failed to save battle result');
        }
      } catch (error) {
        console.error('error saving battle result:', error);
      }
    }
  
    // wire up button event listeners
    fightBtn.addEventListener('click', runBattle);
    rematchBtn.addEventListener('click', runBattle);
  })();
  