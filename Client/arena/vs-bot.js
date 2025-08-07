// bot battle interface handler
// manages pokemon selection, battle start, user auth for bot battles

(async () => {
    // check user and show name in header
    try {
      const meRes = await fetch('/api/me', { credentials: 'same-origin' });
      if (!meRes.ok) throw new Error();
      const me = await meRes.json();
      document.getElementById('user-name').textContent = me.firstName;
    } catch {
      return location.replace('/login');
    }
  
    // nav button event handlers
    document.getElementById('back-btn')
      .addEventListener('click', () => location.href = '/arena');
    document.getElementById('back-to-search-btn')
      .addEventListener('click', () => location.href = '/');
  
    // load and show user's favorite pokemon for picking
    let selectedId = null;
    
    try {
      const favsRes = await fetch('/api/favorites', { credentials: 'same-origin' });
      if (!favsRes.ok) throw new Error('failed to fetch favorites');
      const response = await favsRes.json();
      const favs = response.favorites || [];
      
      const container = document.getElementById('favorites-list');
      
      if (favs.length === 0) {
        container.innerHTML = '<p>no favorites found. add some pokemon to your favorites first!</p>';
        return;
      }
      
      favs.forEach(p => {
        const card = document.createElement('div');
        card.className = 'pokemon-card';
        card.innerHTML = `
          <h2>#${p.id} – ${p.name}</h2>
          <img src="${p.image}" alt="${p.name}">
          <p><strong>types:</strong> ${p.types?.join(', ') || '?'}</p>
          <p><strong>abilities:</strong> ${p.abilities?.join(', ') || '?'}</p>
          <div class="details">
            <p><strong>hp:</strong> ${p.stats?.hp || '?'}</p>
            <p><strong>attack:</strong> ${p.stats?.attack || '?'}</p>
            <p><strong>defense:</strong> ${p.stats?.defense || '?'}</p>
            <p><strong>speed:</strong> ${p.stats?.speed || '?'}</p>
          </div>
        `;
        
        // add click to expand functionality
        card.addEventListener('click', () => {
          card.classList.toggle('expanded');
        });
        
        // add selection functionality
        card.addEventListener('click', (e) => {
          // don't select if clicking on expanded details
          if (e.target.closest('.details')) return;
          
          selectedId = p.id;
          // highlight selected card
          container.querySelectorAll('.selected')
            .forEach(e => e.classList.remove('selected'));
          card.classList.add('selected');
          document.getElementById('start-battle-btn').disabled = false;
        });
        
        container.appendChild(card);
      });
    } catch (error) {
      console.error('error loading favorites:', error);
      document.getElementById('favorites-list').innerHTML = 
        '<p>error loading favorites. please try again.</p>';
    }
  
    // battle start handler
    const startBattleBtn = document.getElementById('start-battle-btn');
    startBattleBtn.disabled = true; // start disabled until pokemon picked
    
    startBattleBtn.addEventListener('click', async () => {
      if (!selectedId) {
        alert('please select a pokemon first!');
        return;
      }
      
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
      
      const botId = Math.floor(Math.random() * 898) + 1;
      // store the ids in sessionstorage for the battle page to use
      sessionStorage.setItem('playerId', selectedId);
      sessionStorage.setItem('botId', botId);
      window.location.href = `/arena/battle`;
    });
  })();
  