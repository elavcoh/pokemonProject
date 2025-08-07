// leaderboard page handler
// shows top players ranked by wins and battle stats

document.addEventListener('DOMContentLoaded', function() {
  const leaderboardTable = document.getElementById('leaderboard-table');
  const loadingMessage = document.getElementById('loading-message');
  const noPlayersMessage = document.getElementById('no-players-message');
  const refreshBtn = document.getElementById('refresh-btn');
  const backBtn = document.querySelector('.back-to-arena-btn');

  // load leaderboard data when page loads
  loadLeaderboard();

  // refresh button event listener
  refreshBtn.addEventListener('click', loadLeaderboard);

  // back button event listener
  if (backBtn) {
    console.log('back button found:', backBtn);
    backBtn.addEventListener('click', function() {
      console.log('back button clicked!');
      window.location.href = '/arena';
    });
  } else {
    console.error('back button not found!');
  }

  // load leaderboard data from server
  async function loadLeaderboard() {
    try {
      loadingMessage.style.display = 'block';
      leaderboardTable.innerHTML = '';
      noPlayersMessage.style.display = 'none';

      const response = await fetch('/api/leaderboard', {
        method: 'GET',
        credentials: 'same-origin'
      });

      if (!response.ok) {
        throw new Error('failed to fetch leaderboard');
      }

      const data = await response.json();
      
      if (data.players && data.players.length > 0) {
        displayLeaderboard(data.players);
      } else {
        showNoPlayersMessage();
      }
    } catch (error) {
      console.error('error loading leaderboard:', error);
      showNoPlayersMessage();
    } finally {
      loadingMessage.style.display = 'none';
    }
  }

  // show leaderboard table with player rankings
  function displayLeaderboard(players) {
    // create header row
    const header = document.createElement('div');
    header.className = 'leaderboard-header';
    header.innerHTML = `
      <div>rank</div>
      <div>username</div>
      <div>total score</div>
      <div>wins</div>
      <div>losses</div>
      <div>total battles</div>
      <div>success rate</div>
    `;
    leaderboardTable.appendChild(header);

    // create rows for each player
    players.forEach((player, index) => {
      const row = document.createElement('div');
      row.className = 'leaderboard-row';
      
      // add current-user class if this is the current user
      if (player.isCurrentUser) {
        row.classList.add('current-user');
      }

      const rank = index + 1;
      const successRate = player.totalBattles > 0 ? Math.round((player.wins / player.totalBattles) * 100) : 0;
      const successRateClass = getSuccessRateClass(successRate);

      row.innerHTML = `
        <div class="rank rank-${rank <= 3 ? rank : ''}">${rank}</div>
        <div class="username">${player.firstName}</div>
        <div class="total-score">${player.totalScore}</div>
        <div class="wins">${player.wins}</div>
        <div class="losses">${player.losses}</div>
        <div class="total-battles">${player.totalBattles}</div>
        <div class="success-rate ${successRateClass}">${successRate}%</div>
      `;
      
      leaderboardTable.appendChild(row);
    });
  }

  // get css class for success rate color coding
  function getSuccessRateClass(rate) {
    if (rate >= 70) return 'high';
    if (rate >= 40) return 'medium';
    return 'low';
  }

  // show message when no players found
  function showNoPlayersMessage() {
    noPlayersMessage.style.display = 'block';
  }
}); 