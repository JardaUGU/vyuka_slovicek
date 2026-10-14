async function syncData() {
  const statusEl = document.getElementById("footer-status");
  if (statusEl) statusEl.innerText = "Stahuji...";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // Dostatek času pro Google Cloud (25 s)
    const res = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    const json = await res.json();

    if (json.error) {
      if (statusEl) statusEl.innerText = "Chyba tabulky: " + json.error;
      renderScreen();
      return;
    }

    if (json && json.items) {
      appData = json;
      localStorage.setItem("app_data", JSON.stringify(json));
      if (statusEl) statusEl.innerText = `OK: ${appData.items.length} úloh`;

      // SYNCHRONIZACE ČASU Z CLOUDU MEZI ZAŘÍZENÍMI
      if (currentUser && appData.users) {
        const foundU = appData.users.find(u => u.name.toLowerCase() === currentUser.name.toLowerCase());
        if (foundU) {
          currentUser.targetMinutes = foundU.targetMinutes || 15;
          currentUser.grade = parseInt(foundU.grade) || 2;
          
          if (foundU.todayMinutes !== undefined) {
            const cloudSec = Math.round(Number(foundU.todayMinutes) * 60);
            if (cloudSec > todaySecondsStudied) {
              todaySecondsStudied = cloudSec;
              localStorage.setItem(getStudyTimeKey(currentUser.name), todaySecondsStudied);
            }
          }
          localStorage.setItem("cur_user", JSON.stringify(currentUser));
        }
      }
    }
  } catch(e) {
    console.error("Detail chyby syncu:", e);
    if (statusEl) {
      statusEl.innerText = e.name === "AbortError" ? "Chyba: Vypršel čas (25s)" : ("Chyba: " + e.message);
    }
  }
  renderScreen();
}
