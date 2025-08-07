// pokemon search and display stuff
// handles api calls, search, favorites, card creation

// dom elements for search interface
const input            = document.getElementById("pokemon-input");
const searchType       = document.getElementById("search-type");
const searchButton     = document.getElementById("search-button");
const clearButton      = document.getElementById("clear-button");
const pokemonContainer = document.getElementById("pokemon-container");
const errorMessage     = document.getElementById("error-message");
const loadingScreen    = document.getElementById("loading-screen");

// user's favorite pokemon list
let favorites = [];

// cache for pokemon data to avoid repeated api calls
let allPokemonList = null;
const detailsCache = new Map();

// get all pokemon list from pokeapi
async function fetchAllPokemon() {
  if (!allPokemonList) {
    const res = await fetch("https://pokeapi.co/api/v2/pokemon?limit=1000");
    const data = await res.json();
    allPokemonList = data.results;
  }
  return allPokemonList;
}

// get detailed pokemon info from api
async function fetchPokemonDetails(url) {
  if (detailsCache.has(url)) return detailsCache.get(url);
  const res = await fetch(url);
  const data = await res.json();
  const statsMap = {};
  data.stats.forEach(s => { statsMap[s.stat.name] = s.base_stat; });
  const info = {
    id:        data.id,
    name:      data.name,
    types:     data.types.map(t => t.type.name),
    abilities: data.abilities.map(a => a.ability.name),
    image:     data.sprites.front_default,
    stats: {
      hp:      statsMap.hp,
      attack:  statsMap.attack,
      defense: statsMap.defense,
      speed:   statsMap.speed
    }
  };
  detailsCache.set(url, info);
  return info;
}

// flip pokemon favorite status and update server
async function toggleFavorite(pokemon, card, btn) {
  const isCurrentlyFavorite = favorites.some(f => f.id === pokemon.id);

  if (isCurrentlyFavorite) {
    // remove from favorites
    try {
      const res = await fetch("/api/favorites/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id: pokemon.id }),
      });

      const data = await res.json();
      if (res.ok) {
        favorites = data.favorites;
        card.classList.remove("added-to-favorites");
        btn.textContent = "add to favorites";
      } else {
        alert(data.error || "failed to remove favorite.");
      }

    } catch (err) {
      console.error("error removing favorite:", err);
      alert("error removing favorite.");
    }

  } else {
    // add to favorites
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          id: pokemon.id,
          name: pokemon.name,
          image: pokemon.image,
          types: pokemon.types,
          abilities: pokemon.abilities,
          stats: pokemon.stats
        })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "failed to add favorite.");
        return;
      }

      favorites = data.favorites;
      card.classList.add("added-to-favorites");
      btn.textContent = "remove from favorites";

    } catch (err) {
      console.error("error adding favorite:", err);
      alert("error adding favorite.");
    }
  }
}

// get youtube video id for pokemon
async function fetchVideoId(pokemonName, category) {
  const apiKey = window.YOUTUBE_API_KEY;
  const query = `${pokemonName} ${category}`;
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&key=${apiKey}&maxResults=1&type=video`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.items?.[0]?.id?.videoId || null;
  } catch (error) {
    console.error("error fetching youtube video:", error);
    return null;
  }
}

// create pokemon card html element
function createPokemonCard(pokemon) {
  const card = document.createElement("div");
  card.className = "pokemon-card";

  card.innerHTML = `
    <h2>#${pokemon.id} - ${pokemon.name}</h2>
    <img src="${pokemon.image}" alt="${pokemon.name}" />
    <p><strong>types:</strong> ${pokemon.types?.join(", ") || "?"}</p>
    <p><strong>abilities:</strong> ${pokemon.abilities?.join(", ") || "?"}</p>
    <div class="details">
      <p><strong>hp:</strong> ${pokemon.stats?.hp || "?"}</p>
      <p><strong>attack:</strong> ${pokemon.stats?.attack || "?"}</p>
      <p><strong>defense:</strong> ${pokemon.stats?.defense || "?"}</p>
      <p><strong>speed:</strong> ${pokemon.stats?.speed || "?"}</p>
      <div class="youtube-videos">
        <h3>related videos:</h3>
        <ul class="yt-list"><li>loading videos…</li></ul>
      </div>
    </div>
  `;

  // check if pokemon is already in favorites
  const isFavorite = favorites.some(f => f.id === pokemon.id);
  if (isFavorite) {
    card.classList.add("added-to-favorites");
  }

  // click to expand/collapse like in favorites
  card.addEventListener("click", async () => {
    const nowExpanded = card.classList.toggle("expanded");
    if (nowExpanded) {
      const ul = card.querySelector(".yt-list");
      ul.innerHTML = "";
      for (let cat of ["trailer", "gameplay", "anime"]) {
        const vid = await fetchVideoId(pokemon.name, cat);
        const li = document.createElement("li");
        if (vid) {
          li.innerHTML = `<a href="https://youtu.be/${vid}" target="_blank">${cat}</a>`;
        } else {
          li.textContent = `${cat}: not found`;
        }
        ul.appendChild(li);
      }
    }
  });

  // create favorite button like in favorites page
  const favoriteBtn = document.createElement("button");
  favoriteBtn.className = "add-to-favorites";
  favoriteBtn.textContent = isFavorite ? "remove from favorites" : "add to favorites";
  favoriteBtn.addEventListener("click", async function (e) {
    e.stopPropagation();
    await toggleFavorite(pokemon, card, favoriteBtn);
  });
  card.appendChild(favoriteBtn);

  return card;
}

// search pokemon based on query and filter type
async function searchPokemon(query, filter) {
  if (!query.trim()) return [];

  // show loading screen
  loadingScreen.style.display = "flex";
  errorMessage.textContent = "";
  pokemonContainer.innerHTML = "";

  try {
    const allPokemon = await fetchAllPokemon();
    const results = [];

    for (const pokemon of allPokemon) {
      const details = await fetchPokemonDetails(pokemon.url);
      let matches = false;

      switch (filter) {
        case "name":
          matches = details.name.toLowerCase().includes(query.toLowerCase());
          break;
        case "id":
          matches = details.id.toString() === query;
          break;
        case "type":
          matches = details.types.some(type => 
            type.toLowerCase().includes(query.toLowerCase())
          );
          break;
        case "ability":
          matches = details.abilities.some(ability => 
            ability.toLowerCase().includes(query.toLowerCase())
          );
          break;
      }

      if (matches) {
        results.push(details);
      }
    }

    // hide loading screen
    loadingScreen.style.display = "none";

    // display results
    if (results.length === 0) {
      errorMessage.textContent = `No Pokemon found for "${query}" in ${filter} search.`;
    } else {
      results.forEach(pokemon => {
        const card = createPokemonCard(pokemon);
        pokemonContainer.appendChild(card);
      });
    }

    return results;
  } catch (error) {
    // hide loading screen on error
    loadingScreen.style.display = "none";
    errorMessage.textContent = "Error searching Pokemon. Please try again.";
    console.error("Search error:", error);
    return [];
  }
}


// event listeners for search interface
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    searchButton.click();
  }
});

// search button click handler
searchButton.addEventListener("click", async () => {
  const q = input.value.trim();
  if (!q) {
    errorMessage.textContent = "Please enter a search term.";
    return;
  }
  await searchPokemon(q, searchType.value);
});

// clear button click handler
clearButton.addEventListener("click", () => {
  input.value = "";
  pokemonContainer.innerHTML = "";
  errorMessage.textContent = "";
});

// initialize page when dom loads
window.addEventListener("DOMContentLoaded", async () => {
  // hide loading screen initially
  loadingScreen.style.display = "none";
  
  try {
    const res = await fetch("/api/favorites", { credentials: "same-origin" });
    const data = await res.json();
    favorites = data.favorites || [];
  } catch (err) {
    console.error("failed to load favorites from server:", err);
    favorites = [];
  }

  const savedSearch = sessionStorage.getItem("savedSearch");
  const savedFilter = sessionStorage.getItem("savedFilter");

  if (savedSearch && savedFilter) {
    input.value = savedSearch;
    searchType.value = savedFilter;
    searchPokemon(savedSearch, savedFilter);
    sessionStorage.removeItem("savedSearch");
    sessionStorage.removeItem("savedFilter");
  }
});