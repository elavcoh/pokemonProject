// favorites page functionality for managing user's favorite pokemon
// handles display, sorting, removal, and export of favorite pokemon

// dom element references for favorites interface
const container       = document.getElementById("favorites-container");
const backButton      = document.getElementById("back-button");
const sortSelect      = document.getElementById("sort-select");
const downloadButton  = document.getElementById("download-csv-button");
const loadingScreen   = document.getElementById("loading-screen");

// user's favorite pokemon list and cache
let favorites = [];
const detailsCache = new Map();

// back to search page navigation
backButton?.addEventListener("click", () => {
  window.location.href = "/search";
});

// sort favorites by name or id
function sortFavorites(list, sortBy) {
  const sorted = [...list];
  if (sortBy === "name") {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === "id") {
    sorted.sort((a, b) => a.id - b.id);
  }
  return sorted;
}

// display all favorite pokemon cards
function renderFavorites(favList) {
  container.innerHTML = "";
  for (const fav of favList) {
    const card = createPokemonCard(fav);
    container.appendChild(card);
  }
}

// get pokemon details by id from api
async function fetchPokemonDetailsById(id) {
  const url = `https://pokeapi.co/api/v2/pokemon/${id}`;
  return await fetchPokemonDetails(url);
}

// get complete pokemon details from api
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

// get youtube video by category
async function fetchVideoId(pokemonName, category) {
  const key = window.YOUTUBE_API_KEY;
  if (!key) return null;
  const q = encodeURIComponent(`${pokemonName} ${category}`);
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${q}&key=${key}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    return json.items?.[0]?.id?.videoId || null;
  } catch (e) {
    console.warn("youtube api error:", e);
    return null;
  }
}

// create pokemon card html element
function createPokemonCard(pokemon) {
  const card = document.createElement("div");
  card.className = "pokemon-card added-to-favorites";

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

  const favButton = document.createElement("button");
  favButton.className = "add-to-favorites";
  favButton.textContent = "remove from favorites";
  favButton.addEventListener("click", async function (e) {
    e.stopPropagation();
    favorites = favorites.filter(f => parseInt(f.id) !== parseInt(pokemon.id));
    card.remove();
    try {
      const res = await fetch("/api/favorites/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id: parseInt(pokemon.id) }),
      });
      const data = await res.json();
      console.log("removed from server:", data);
    } catch (err) {
      console.error("failed to remove from favorites:", err);
    }
  });

  card.appendChild(favButton);
  return card;
}

// load favorites from server and fetch complete details
async function loadFavorites() {
  try {
    const res = await fetch("/api/favorites", { credentials: "same-origin" });
    if (!res.ok) throw new Error("not logged in");

    const data = await res.json();
    const serverFavorites = Array.isArray(data.favorites) ? data.favorites : [];

    const detailedFavorites = [];
    for (const fav of serverFavorites) {
      const fullDetails = await fetchPokemonDetailsById(fav.id);
      detailedFavorites.push(fullDetails);
    }

    favorites = detailedFavorites;
    const sorted = sortFavorites(favorites, sortSelect.value);
    renderFavorites(sorted);

  } catch (err) {
    alert("error loading favorites. please log in.");
    window.location.href = "/login";
  } finally {
    if (loadingScreen) loadingScreen.style.display = "none";
  }
}

// change sort order from menu
sortSelect.addEventListener("change", () => {
  const sorted = sortFavorites(favorites, sortSelect.value);
  renderFavorites(sorted);
});

// export to CSV
function exportFavoritesToCSV(favList) {
  if (!favList.length) return;

  const headers = ["ID", "Name", "Types", "Abilities", "HP", "Attack", "Defense", "Speed"];
  const rows = favList.map(p => [
    p.id,
    p.name,
    p.types.join(" "),
    p.abilities.join(" "),
    p.stats.hp,
    p.stats.attack,
    p.stats.defense,
    p.stats.speed
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(String).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "favorites.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// click export button
downloadButton.addEventListener("click", () => {
  const sorted = sortFavorites(favorites, sortSelect.value);
  exportFavoritesToCSV(sorted);
});

// start loading
window.addEventListener("DOMContentLoaded", loadFavorites);
