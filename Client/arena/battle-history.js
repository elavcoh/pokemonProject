let battleHistory = [];
let currentFilter = 'all';

// טעינת המשתמש הנוכחי
async function loadCurrentUser() {
    try {
        const res = await fetch('/api/me');
        if (!res.ok) {
            throw new Error('Failed to load user');
        }
        
        const user = await res.json();
        document.getElementById('user-name').textContent = user.firstName;
        
        await loadBattleHistory();
    } catch (error) {
        console.error('Error loading user:', error);
        window.location.href = '/login';
    }
}

// טעינת היסטוריית הקרבות ישירות מ-battles.json
async function loadBattleHistory() {
    try {
        const res = await fetch('/api/all-battles');
        if (!res.ok) {
            throw new Error('Failed to load battles');
        }
        
        const data = await res.json();
        const allBattles = data.battles || [];
        
        // המרת הקרבות לפורמט הנדרש
        battleHistory = allBattles
            .filter(battle => {
                // רק קרבות שהמשתמש הנוכחי השתתף בהם
                return battle.player1Id === data.currentUser.id || 
                       battle.player2Id === data.currentUser.id;
            })
            .map(battle => {
                // המרה לפורמט הנדרש
                const isPlayer1 = battle.player1Id === data.currentUser.id;
                const result = battle.winner === data.currentUser.id ? 'won' : 
                              battle.winner === 'tie' ? 'tie' : 'lost';
                
                // זיהוי סוג הקרב
                const isBot = battle.player2Id === 'bot' || battle.player1Id === 'bot';
                const type = isBot ? 'vs-bot' : 'vs-player';
                
                // יצירת ID קבוע לפוקימון על בסיס השם
                const playerPokemonName = isPlayer1 ? battle.player1Pokemon : battle.player2Pokemon;
                const opponentPokemonName = isPlayer1 ? battle.player2Pokemon : battle.player1Pokemon;
                
                // יצירת ID קבוע על בסיס השם (hash פשוט)
                const playerPokemonId = getPokemonId(playerPokemonName);
                const opponentPokemonId = getPokemonId(opponentPokemonName);
                
                return {
                    id: battle.id,
                    timestamp: new Date(battle.timestamp).getTime(),
                    type: type,
                    result: result,
                    playerPokemon: {
                        name: playerPokemonName,
                        image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${playerPokemonId}.png`,
                        stats: {
                            hp: Math.floor(Math.random() * 100) + 30,
                            attack: Math.floor(Math.random() * 100) + 30,
                            defense: Math.floor(Math.random() * 100) + 30,
                            speed: Math.floor(Math.random() * 100) + 30
                        }
                    },
                    opponentPokemon: {
                        name: opponentPokemonName,
                        image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${opponentPokemonId}.png`,
                        stats: {
                            hp: Math.floor(Math.random() * 100) + 30,
                            attack: Math.floor(Math.random() * 100) + 30,
                            defense: Math.floor(Math.random() * 100) + 30,
                            speed: Math.floor(Math.random() * 100) + 30
                        }
                    },
                    playerScore: isPlayer1 ? battle.player1Score : battle.player2Score,
                    opponentScore: isPlayer1 ? battle.player2Score : battle.player1Score,
                    opponentName: isPlayer1 ? battle.player2Name : battle.player1Name
                };
            });
        
        updateStats();
        renderBattles();
        setupFilters();
    } catch (error) {
        console.error('Error loading battle history:', error);
        document.getElementById('battle-history').innerHTML = 
            '<div class="no-battles">Error loading battle history. Please try again.</div>';
    }
}

// עדכון הסטטיסטיקות
function updateStats() {
    const totalBattles = battleHistory.length;
    const wins = battleHistory.filter(battle => battle.result === 'won').length;
    const winRate = totalBattles > 0 ? Math.round((wins / totalBattles) * 100) : 0;
    
    document.getElementById('total-battles').textContent = totalBattles;
    document.getElementById('total-wins').textContent = wins;
    document.getElementById('win-rate').textContent = winRate + '%';
}

// הצגת הקרבות
function renderBattles() {
    const container = document.getElementById('battle-history');
    
    if (battleHistory.length === 0) {
        container.innerHTML = '<div class="no-battles">No battles found. Start playing to see your history!</div>';
        return;
    }
    
    const filteredBattles = filterBattles(battleHistory, currentFilter);
    
    if (filteredBattles.length === 0) {
        container.innerHTML = '<div class="no-battles">No battles match the current filter.</div>';
        return;
    }
    
    container.innerHTML = filteredBattles.map(battle => createBattleCard(battle)).join('');
}

// סינון קרבות
function filterBattles(battles, filter) {
    switch (filter) {
        case 'won':
            return battles.filter(battle => battle.result === 'won');
        case 'lost':
            return battles.filter(battle => battle.result === 'lost');
        case 'vs-bot':
            return battles.filter(battle => battle.type === 'vs-bot');
        case 'vs-player':
            return battles.filter(battle => battle.type === 'vs-player');
        default:
            return battles;
    }
}

// יצירת כרטיס קרב
function createBattleCard(battle) {
    const date = new Date(battle.timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const battleType = battle.type === 'vs-bot' ? 'VS Bot' : 'VS Player';
    const resultClass = battle.result === 'won' ? 'won' : 'lost';
    const resultText = battle.result === 'won' ? 'Victory!' : 'Defeat';
    
    return `
        <div class="battle-card ${resultClass}">
            <div class="battle-header">
                <span class="battle-type">${battleType}</span>
                <span class="battle-date">${date}</span>
            </div>
            
            <div class="battle-pokemon">
                <div class="pokemon-info">
                    <img src="${battle.playerPokemon.image}" alt="${battle.playerPokemon.name}">
                    <h3>${battle.playerPokemon.name}</h3>
                    <p>HP: ${battle.playerPokemon.stats.hp}</p>
                    <p>Attack: ${battle.playerPokemon.stats.attack}</p>
                    <p>Defense: ${battle.playerPokemon.stats.defense}</p>
                    <p>Speed: ${battle.playerPokemon.stats.speed}</p>
                </div>
                
                <div class="vs-text">VS</div>
                
                <div class="pokemon-info">
                    <img src="${battle.opponentPokemon.image}" alt="${battle.opponentPokemon.name}">
                    <h3>${battle.opponentPokemon.name}</h3>
                    <p>HP: ${battle.opponentPokemon.stats.hp}</p>
                    <p>Attack: ${battle.opponentPokemon.stats.attack}</p>
                    <p>Defense: ${battle.opponentPokemon.stats.defense}</p>
                    <p>Speed: ${battle.opponentPokemon.stats.speed}</p>
                </div>
            </div>
            
            <div class="battle-score">
                <span class="battle-result ${resultClass}">${resultText}</span>
                <br>
                Score: ${battle.playerScore.toFixed(1)} vs ${battle.opponentScore.toFixed(1)}
            </div>
        </div>
    `;
}

// הגדרת הפילטרים
function setupFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // הסרת הפעלה מכל הכפתורים
            filterButtons.forEach(b => b.classList.remove('active'));
            
            // הפעלת הכפתור הנוכחי
            btn.classList.add('active');
            
            // עדכון הפילטר
            currentFilter = btn.dataset.filter;
            renderBattles();
        });
    });
}

// רענון אוטומטי כל 5 שניות
function startAutoRefresh() {
    setInterval(() => {
        loadBattleHistory();
    }, 5000);
}

// אתחול
document.addEventListener('DOMContentLoaded', () => {
    loadCurrentUser();
    startAutoRefresh();
}); 

// פונקציה ליצירת ID קבוע לפוקימון על בסיס השם
function getPokemonId(pokemonName) {
    // רשימת פוקימונים ידועים עם ID שלהם
    const pokemonIds = {
        'pikachu': 25,
        'bulbasaur': 1,
        'charmander': 4,
        'squirtle': 7,
        'jynx': 124,
        'cloyster': 91,
        'dewgong': 87,
        'lapras': 131,
        'articuno': 144,
        'bayleef': 153,
        'vaporeon': 134,
        'flareon': 136,
        'jolteon': 135,
        'espeon': 196,
        'umbreon': 197,
        'leafeon': 470,
        'glaceon': 471,
        'sylveon': 700,
        'eevee': 133,
        'grimer': 88,
        'muk': 89,
        'rattata': 19,
        'raticate': 20
    };
    
    // אם הפוקימון נמצא ברשימה, החזר את ה-ID שלו
    if (pokemonIds[pokemonName.toLowerCase()]) {
        return pokemonIds[pokemonName.toLowerCase()];
    }
    
    // אם לא נמצא, צור ID קבוע על בסיס השם
    let hash = 0;
    for (let i = 0; i < pokemonName.length; i++) {
        const char = pokemonName.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    
    // החזר מספר בין 1 ל-898 (טווח הפוקימונים)
    return Math.abs(hash) % 898 + 1;
} 