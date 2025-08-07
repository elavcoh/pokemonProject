// arena page functionality for battle management
// handles daily battle limits, user information, and battle status display

// load daily battle limit information from server
async function loadDailyBattlesInfo() {
  try {
    const res = await fetch('/api/daily-battles');
    if (!res.ok) {
      throw new Error('failed to fetch daily battles');
    }
    const data = await res.json();
    updateBattlesRemainingDisplay(data.remaining);
    return data;
  } catch (error) {
    console.error('error loading daily battles info:', error);
    // show default message if error
    updateBattlesRemainingDisplay(5);
    return { remaining: 5, canBattle: true };
  }
}

// update the display of remaining battles
function updateBattlesRemainingDisplay(remaining) {
  const battlesInfo = document.getElementById('battles-remaining');
  if (battlesInfo) {
    if (remaining === undefined || remaining === null) {
      battlesInfo.textContent = 'unable to load battle info';
      battlesInfo.style.color = '#f44336';
    } else {
      battlesInfo.textContent = `you have ${remaining} battles remaining today`;
      battlesInfo.style.color = remaining > 0 ? '#2e7d32' : '#f44336';
    }
  }
}

// load current user information
async function loadCurrentUser() {
  try {
    const res = await fetch('/api/me');
    const user = await res.json();
    currentUser = user;
    
    // load daily battle information
    await loadDailyBattlesInfo();
    
  } catch (error) {
    console.error('error loading current user:', error);
  }
}

// initialize page when dom loads
document.addEventListener('DOMContentLoaded', function() {
  // try to load daily battle information
  loadDailyBattlesInfo().catch(error => {
    console.error('failed to load daily battles info:', error);
    updateBattlesRemainingDisplay(5); // default fallback
  });
}); 