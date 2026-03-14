function fmtDate(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function niceDate(iso){
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday:"short", year:"numeric", month:"long", day:"numeric" });
}
async function loadJSON(path){
  const res = await fetch(path, { cache: "no-store" });
  if(!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}
function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function initNavToggle(){
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("primary-nav");
  if(!header || !toggle || !nav) return;

  const setExpanded = (expanded) => toggle.setAttribute("aria-expanded", String(expanded));
  const close = () => {
    header.classList.remove("open");
    setExpanded(false);
  };

  toggle.addEventListener("click", () => {
    const open = header.classList.toggle("open");
    setExpanded(open);
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      close();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
}

/* Home */
async function renderHome(){
  const annEl = document.getElementById("homeAnnouncements");
  const evtEl = document.getElementById("homeEvents");
  if(!annEl || !evtEl) return;

  const [anns, evts] = await Promise.all([
    loadJSON("content/announcements.json"),
    loadJSON("content/events.json"),
  ]);

  anns.sort((a,b)=> (b.date||"").localeCompare(a.date||""));
  annEl.innerHTML = anns.slice(0,3).map(a => `
    <div class="item">
      <div class="top">
        <div class="title">${escapeHtml(a.title||"")}</div>
        <div class="meta">${escapeHtml(niceDate(a.date||fmtDate(new Date())))}</div>
      </div>
      <div class="body">${escapeHtml(a.body||"")}</div>
    </div>
  `).join("");

  const today = fmtDate(new Date());
  evts.sort((a,b)=> (a.date||"").localeCompare(b.date||""));
  const upcoming = evts.filter(e => (e.date||"") >= today).slice(0,3);

  evtEl.innerHTML = (upcoming.length ? upcoming : evts.slice(0,3)).map(e => `
    <div class="item">
      <div class="top">
        <div class="title">${escapeHtml(e.title||"")}</div>
        <div class="meta">${escapeHtml(niceDate(e.date||today))}${e.time ? " • " + escapeHtml(e.time) : ""}</div>
      </div>
      <div class="body">
        ${e.location ? `<div><span class="btn btn--static">📍 ${escapeHtml(e.location)}</span></div>` : ""}
        ${e.description ? `<div class="mt-2">${escapeHtml(e.description)}</div>` : ""}
      </div>
    </div>
  `).join("");
}

/* Announcements page */
async function renderAnnouncements(){
  const list = document.getElementById("annList");
  if(!list) return;
  const anns = await loadJSON("content/announcements.json");
  anns.sort((a,b)=> (b.date||"").localeCompare(a.date||""));
  list.innerHTML = anns.map(a => `
    <div class="item">
      <div class="top">
        <div class="title">${escapeHtml(a.title||"")}</div>
        <div class="meta">${escapeHtml(niceDate(a.date||fmtDate(new Date())))}</div>
      </div>
      <div class="body">${escapeHtml(a.body||"")}</div>
    </div>
  `).join("");
}

/* Calendar */
let calState = { year:null, month:null, selected:null, events:[] };

function monthLabel(year, monthIndex){
  const d = new Date(year, monthIndex, 1);
  return d.toLocaleDateString(undefined, { month:"long", year:"numeric" });
}
function eventsByDate(events){
  const map = new Map();
  for(const e of events){
    const key = e.date;
    if(!key) continue;
    if(!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  }
  return map;
}
function renderDayEvents(dateISO){
  const box = document.getElementById("dayEvents");
  const label = document.getElementById("selectedDayLabel");
  if(!box || !label) return;

  label.textContent = niceDate(dateISO);
  const items = calState.events.filter(e => e.date === dateISO);

  if(items.length === 0){
    box.innerHTML = `<div class="item"><div class="body">No events listed for this day.</div></div>`;
    return;
  }

  box.innerHTML = items.map(e => `
    <div class="item">
      <div class="top">
        <div class="title">${escapeHtml(e.title||"")}</div>
        <div class="meta">${e.time ? escapeHtml(e.time) : ""}</div>
      </div>
      <div class="body">
        ${e.location ? `<div><span class="btn btn--static">📍 ${escapeHtml(e.location)}</span></div>` : ""}
        ${e.description ? `<div class="mt-2">${escapeHtml(e.description)}</div>` : ""}
      </div>
    </div>
  `).join("");
}
function cellHtml(d, map, muted){
  const iso = fmtDate(d);
  const count = (map.get(iso)||[]).length;
  const badge = count ? `<span class="badge">${count} event${count>1?"s":""}</span>` : "";
  return `
    <div class="cell ${muted ? "muted":""}" data-date="${iso}">
      <div class="daynum">${d.getDate()}</div>
      ${badge}
    </div>
  `;
}
function highlightSelected(){
  const cal = document.getElementById("calendarGrid");
  if(!cal) return;
  cal.querySelectorAll(".cell").forEach(c => c.classList.remove("selected"));
  const sel = cal.querySelector(`[data-date="${calState.selected}"]`);
  if(sel) sel.classList.add("selected");
}
function buildCalendar(){
  const cal = document.getElementById("calendarGrid");
  const monthText = document.getElementById("monthText");
  if(!cal || !monthText) return;

  const { year, month } = calState;
  monthText.textContent = monthLabel(year, month);

  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const map = eventsByDate(calState.events);

  const dowRow = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
    .map(d => `<div class="dow">${d}</div>`).join("");

  let cells = "";
  for(let i=0;i<startDow;i++){
    const dayNum = daysInPrev - (startDow-1-i);
    const d = new Date(year, month-1, dayNum);
    cells += cellHtml(d, map, true);
  }
  for(let day=1; day<=daysInMonth; day++){
    const d = new Date(year, month, day);
    cells += cellHtml(d, map, false);
  }
  const totalCells = startDow + daysInMonth;
  const trailing = (totalCells <= 35) ? (35 - totalCells) : (42 - totalCells);
  for(let i=1;i<=trailing;i++){
    const d = new Date(year, month+1, i);
    cells += cellHtml(d, map, true);
  }

  cal.innerHTML = dowRow + cells;

  const today = new Date();
  const inMonth = (today.getFullYear()===year && today.getMonth()===month);
  calState.selected = calState.selected || (inMonth ? fmtDate(today) : fmtDate(new Date(year, month, 1)));

  highlightSelected();
  renderDayEvents(calState.selected);

  cal.querySelectorAll("[data-date]").forEach(el => {
    el.addEventListener("click", () => {
      calState.selected = el.getAttribute("data-date");
      highlightSelected();
      renderDayEvents(calState.selected);
    });
  });
}
async function renderEventsCalendar(){
  const cal = document.getElementById("calendarGrid");
  if(!cal) return;

  const events = await loadJSON("content/events.json");
  events.sort((a,b)=> (a.date||"").localeCompare(b.date||""));
  calState.events = events;

  const now = new Date();
  calState.year = now.getFullYear();
  calState.month = now.getMonth();

  document.getElementById("prevMonth")?.addEventListener("click", () => {
    calState.month--;
    if(calState.month < 0){ calState.month = 11; calState.year--; }
    calState.selected = null;
    buildCalendar();
  });

  document.getElementById("nextMonth")?.addEventListener("click", () => {
    calState.month++;
    if(calState.month > 11){ calState.month = 0; calState.year++; }
    calState.selected = null;
    buildCalendar();
  });

  buildCalendar();
}

document.addEventListener("DOMContentLoaded", async () => {
  initNavToggle();
  try{
    await renderHome();
    await renderAnnouncements();
    await renderEventsCalendar();
  }catch(err){
    console.error(err);
  }
});