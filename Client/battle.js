// battle page handler
// manages pokemon battle interface, user auth, battle logic

(async () => {
    // nav buttons for user flow
    document.getElementById('back-btn')
      .addEventListener('click', () => history.back());
    document.getElementById('back-to-search-btn')
      .addEventListener('click', () => location.href = '/');
  
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
    const params   = new URLSearchParams(location.search);
    const playerId = params.get('player'), botId = params.get('bot');
    async function getPokemon(id) {
      const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
      return r.json();
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
          <p><strong>HP:</strong> ${stat('hp')}</p>
          <p><strong>Attack:</strong> ${stat('attack')}</p>
          <p><strong>Defense:</strong> ${stat('defense')}</p>
          <p><strong>Speed:</strong> ${stat('speed')}</p>
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
      // reset UI
      pcEl.classList.remove('winner','loser');
      bcEl.classList.remove('winner','loser');
      cdEl.textContent = '';
      resEl.textContent = '';
  
      // hide Start -> show only Rematch at end
      fightBtn.style.display   = 'none';
      rematchBtn.style.display = 'none';
  
      // compute scores
      const w = { hp:0.3, attack:0.4, defense:0.2, speed:0.1 };
      const statVal = (o,n) => o.stats.find(s=>s.stat.name===n).base_stat;
      const rnd      = () => Math.random() * 10;
      const score    = p =>
        w.hp      * statVal(p,'hp') +
        w.attack  * statVal(p,'attack') +
        w.defense * statVal(p,'defense') +
        w.speed   * statVal(p,'speed') +
        rnd();
  
      const pScore = score(player), bScore = score(bot);
  
      // countdown 3…2…1…Fight!
      let cnt = 3;
      cdEl.textContent = cnt;
      const iv = setInterval(() => {
        cnt--;
        if (cnt > 0) {
          cdEl.textContent = cnt;
        } else {
          clearInterval(iv);
          cdEl.textContent = 'Fight!';
          // highlight
          if (pScore > bScore) {
            pcEl.classList.add('winner');
            bcEl.classList.add('loser');
            resEl.textContent = 'You Win!';
          } else if (bScore > pScore) {
            bcEl.classList.add('winner');
            pcEl.classList.add('loser');
            resEl.textContent = 'Bot Wins!';
          } else {
            resEl.textContent = "It's a Tie!";
          }
          document.getElementById('battle-end-sound').play();

          // show Rematch only
          rematchBtn.style.display = 'inline-block';
        }
      }, 1000);
    }
  
    // wire buttons
    fightBtn.addEventListener('click', runBattle);
    rematchBtn.addEventListener('click', runBattle);
  })();
  