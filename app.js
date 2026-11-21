/* PassItOn app.js (plain JavaScript, no frameworks)
   1 settings · 2 helpers · 3 data (local or Supabase) · 4 login · 5 checking a post
   6 drawing the page · 7 buttons · 8 start

   HOW APPROVAL WORKS (like OLX):
   a student posts  ->  listing is "pending"  ->  a moderator approves or rejects  ->  only "approved" listings show on the board */

// ---------- 1. SETTINGS ----------
const C = window.CFG;
// If Supabase details are still placeholders we run in DEMO mode (data stays in this browser)
const DEMO = C.SUPABASE_URL.includes("YOUR-PROJECT") || C.SUPABASE_KEY.includes("YOUR-ANON");
const CATS = ["Books & notes", "Electronics", "Lab & drafting", "Hostel & furniture", "Clothes", "Cycles & sports", "Kitchen", "Other"];
const CONDS = ["Like new", "Good", "Well used"];
const MAX_PRICE = 50000;   // sanity limit
const PHOTO_ABOVE = 1000;  // items at or above this price must have a photo
const MAX_ACTIVE = 5;      // pending + live listings per student
const EXPIRE_DAYS = 30;    // live listings disappear after this long (owner can repost)
const sb = DEMO ? null : supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY);

let user = null;        // {id, email} when logged in
let isMod = false;      // true for moderators
let items = [];         // all listings this person is allowed to see
let view = "browse";    // which tab: browse | mine | queue
let activeCat = "";     // selected category chip
let photo = null;       // resized photo for the post form
let lastSend = 0, openId = null;
let listMode = localStorage.getItem("pio_list") === "1";   // grid or list view
let saved = JSON.parse(localStorage.getItem("pio_saved") || "[]");   // saved listing ids (this browser)

// little line-art pictures used when a listing has no photo
const ICONS = {
  "Books & notes": '<rect x="8" y="10" width="40" height="11" rx="2"/><rect x="14" y="23" width="42" height="11" rx="2"/><rect x="10" y="36" width="38" height="11" rx="2"/><path d="M14 53h36"/>',
  "Electronics": '<rect x="12" y="14" width="40" height="28" rx="3"/><path d="M6 48h52l-4 7H10z"/>',
  "Lab & drafting": '<path d="M12 54V12l40 42z"/><circle cx="22" cy="42" r="4"/><path d="M12 24h8M12 34h6"/>',
  "Hostel & furniture": '<path d="M22 10h20l9 24H13z"/><path d="M32 34v18M22 56h20"/>',
  "Clothes": '<path d="M22 8l-15 9 6 11 7-3v29h24V25l7 3 6-11-15-9c-2 4-5 6-10 6s-8-2-10-6z"/>',
  "Cycles & sports": '<circle cx="15" cy="42" r="10"/><circle cx="49" cy="42" r="10"/><path d="M15 42l11-19h15l8 19M26 23l9 19M21 18h9M41 23l-3-8h-7"/>',
  "Kitchen": '<path d="M15 26h30l-2 28H17z"/><path d="M45 31c11 0 11 15 0 15M15 32L6 25M25 20h10v6H25z"/>',
  "Other": '<path d="M9 24l23-11 23 11v25L32 60 9 49z"/><path d="M9 24l23 11 23-11M32 35v25"/>'
};
function icon(cat) {
  return '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[cat] || ICONS["Other"]) + "</svg>";
}

// ---------- 2. HELPERS ----------
const $ = id => document.getElementById(id);
function clean(t) {   // stops people typing HTML into a listing
  return String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function store(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key));
    if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value));
  } catch (e) { say("Browser storage is full or blocked."); }
}
function timeAgo(iso) {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + " min ago";
  if (m < 1440) return Math.floor(m / 60) + " h ago";
  return Math.floor(m / 1440) + " d ago";
}
const expired = i => (Date.now() - new Date(i.created_at)) > EXPIRE_DAYS * 86400000;
let snackTimer;
function say(msg) {   // small message at the bottom of the screen
  $("snack").textContent = msg; $("snack").classList.add("show");
  clearTimeout(snackTimer); snackTimer = setTimeout(() => $("snack").classList.remove("show"), 3800);
}

// ---------- 3. DATA ----------
// Every function below works in local (no-server) mode AND Supabase mode, so the rest of the code doesn't care which one is running.
function seedListings() {
  const mk = (id, mail, title, cat, price, cond, desc, pickup, mins, approval) => ({
    id, user_id: mail, seller_email: mail, title, category: cat, price, condition: cond, description: desc, pickup,
    image_url: null, status: "available", approval, reject_reason: null, reports: 0,
    created_at: new Date(Date.now() - mins * 60000).toISOString()
  });
  return [
    mk("s1", "rohan.m@campus.example", "Engineering Mechanics textbook", "Books & notes", 250, "Good", "Used for one semester. No torn pages or markings.", "Academic block", 25, "approved"),
    mk("s2", "sneha.k@campus.example", "Mini drafter with set squares", "Lab & drafting", 150, "Like new", "Complete set with both set squares. No cracks.", "Hostel gate", 90, "approved"),
    mk("s3", "aman.s@campus.example", "Hero cycle, 6 months old", "Cycles & sports", 2800, "Good", "Lock included. Tyres are in good shape. Can meet in the evening.", "Main gate", 300, "approved"),
    mk("s4", "diya.p@campus.example", "Electric kettle 1.5L", "Kitchen", 400, "Good", "Works perfectly. I am leaving the hostel this month.", "Hostel gate", 1500, "approved"),
    mk("s5", "kabir.j@campus.example", "Study table lamp", "Hostel & furniture", 200, "Well used", "Bulb included. The neck is adjustable.", "Library", 3000, "approved"),
    mk("s8", "isha.r@campus.example", "Casio fx-991EX calculator", "Electronics", 650, "Like new", "Used for one semester. Cover included. Works perfectly.", "Library", 600, "approved"),
    mk("s9", "neil.d@campus.example", "Bucket and mug set", "Hostel & furniture", 120, "Good", "Big bucket with a mug. Cleaned and ready to use.", "Hostel gate", 2000, "approved"),
    mk("s10", "tara.b@campus.example", "Formal shirt, size M", "Clothes", 300, "Good", "Worn only twice for presentations. Washed and ironed.", "Canteen", 4000, "approved"),
    mk("s6", "meera.t@campus.example", "Acoustic guitar with bag", "Other", 1800, "Good", "Strings changed last month. Selling because I do not practise anymore.", "Canteen", 10, "pending"),
    mk("s7", "arjun.v@campus.example", "Bluetooth speaker", "Electronics", 600, "Like new", "Battery lasts about 8 hours. Charger included.", "Library", 5, "pending")
  ];
}
async function loadListings() {
  if (DEMO) {
    let all = store("pio_listings");
    if (!all) { all = seedListings(); store("pio_listings", all); }
    const reps = store("pio_reports") || {};
    return all.map(i => ({ ...i, reports: (reps[i.id] || []).length }));
  }
  // logged-out visitors can browse approved listings, but never see seller emails (the database enforces this too)
  const cols = user ? "*" : "id,title,category,price,condition,pickup,description,image_url,status,approval,reports,created_at";
  const res = await sb.from("listings").select(cols).order("created_at", { ascending: false });
  if (res.error) { say("Could not load listings: " + res.error.message); return []; }
  return res.data;
}
async function saveListing(item, photoData) {   // returns an error message, or null if it worked
  if (DEMO) {
    const all = store("pio_listings") || seedListings();
    all.unshift({ id: String(Date.now()), user_id: user.id, seller_email: user.email, ...item, image_url: photoData, status: "available", approval: "pending", reject_reason: null, reports: 0, created_at: new Date().toISOString() });
    store("pio_listings", all);
    return null;
  }
  let url = null;
  if (photoData) {
    const blob = await (await fetch(photoData)).blob();
    const path = user.id + "/" + Date.now() + ".jpg";
    const up = await sb.storage.from("item-photos").upload(path, blob, { contentType: "image/jpeg" });
    if (up.error) return "Photo upload failed: " + up.error.message;
    url = sb.storage.from("item-photos").getPublicUrl(path).data.publicUrl;
  }
  const res = await sb.from("listings").insert({ ...item, image_url: url });   // the database sets approval = pending by itself
  return res.error ? res.error.message : null;
}
async function changeListing(id, changes) {
  if (DEMO) { store("pio_listings", (store("pio_listings") || []).map(i => i.id === id ? { ...i, ...changes } : i)); return; }
  const res = await sb.from("listings").update(changes).eq("id", id);
  if (res.error) say(res.error.message);
}
async function removeListing(id) {
  if (DEMO) { store("pio_listings", (store("pio_listings") || []).filter(i => i.id !== id)); return; }
  await sb.from("listings").delete().eq("id", id);
}
async function reportListing(id, reason) {
  if (DEMO) {
    const reps = store("pio_reports") || {};
    reps[id] = reps[id] || [];
    if (reps[id].includes(user.id)) return false;
    reps[id].push(user.id); store("pio_reports", reps); return true;
  }
  const res = await sb.from("reports").insert({ listing_id: id, reason });
  return !res.error;
}

// ---------- 4. LOGIN ----------
async function sendCode(email) {
  if (DEMO) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    store("pio_code", { email, code });
    $("dcode").textContent = code; $("mailBox").hidden = false;
    return null;
  }
  const res = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  return res.error ? res.error.message : null;
}
async function checkCode(email, code) {
  if (DEMO) {
    const sent = store("pio_code");
    if (!sent || sent.email !== email || sent.code !== code) return "Wrong code.";
    user = { id: email, email };
    store("pio_user", user);
    return null;
  }
  const res = await sb.auth.verifyOtp({ email, token: code, type: "email" });
  return res.error ? "Wrong or expired code." : null;
}
async function logout() {
  if (DEMO) { store("pio_user", null); user = null; await refresh(); return; }
  await sb.auth.signOut();
}
async function findOutIfMod() {   // asks the database (real mode) or the config list (local mode)
  if (!user) return false;
  if (DEMO) return (C.MODERATORS || []).includes(user.email);
  const res = await sb.rpc("is_mod");
  return res.data === true;
}

// ---------- 5. CHECKING A POST (basic checks only; moderators do the real checking) ----------
function myActive() {
  return items.filter(i => user && i.user_id === user.id && i.status === "available" && i.approval !== "rejected" && !expired(i)).length;
}
function checkPost(item, photoData) {   // returns a message if something is wrong, or null if fine
  if (item.title.length < 3) return "Give your item a proper title.";
  if (isNaN(item.price) || item.price < 0) return "Enter a price (0 if it's free).";
  if (item.price > MAX_PRICE) return "Price can't be more than ₹" + MAX_PRICE.toLocaleString("en-IN") + ".";
  if (item.pickup.length < 2) return "Add a pickup spot, like Library or Hostel gate.";
  if (item.description.length < 10) return "Add a few details (at least 10 characters): condition, flaws, where you can meet.";
  if (item.price >= PHOTO_ABOVE && !photoData) return "Add a photo for items priced ₹" + PHOTO_ABOVE.toLocaleString("en-IN") + " or more.";
  if (myActive() >= MAX_ACTIVE) return "You already have " + MAX_ACTIVE + " active posts. Mark one as sold or delete it first.";
  if (!$("agree").checked) return "Please tick the box to confirm you own the item.";
  return null;
}

// ---------- 6. DRAWING THE PAGE ----------
const onBoard = i => i.approval === "approved" && !expired(i) && (isMod || (i.reports || 0) < 3);   // what the public board shows
const HEART = on => `<svg viewBox="0 0 24 24" width="17" height="17" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20.5s-7.5-4.6-9.4-9.4C1.3 7.8 3.4 4.5 6.8 4.5c2 0 3.5 1 5.2 2.8 1.7-1.8 3.2-2.8 5.2-2.8 3.4 0 5.5 3.3 4.2 6.6-1.9 4.8-9.4 9.4-9.4 9.4z"/></svg>`;
function nameOf(email) {
  if (!email) return "Campus seller";
  const first = email.split("@")[0].split(/[._]/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}
const catClass = c => "c" + Math.max(0, CATS.indexOf(c));   // each category has its own colour (see style.css)
const ALLICON = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="10" width="18" height="18" rx="4"/><rect x="36" y="10" width="18" height="18" rx="4"/><rect x="10" y="36" width="18" height="18" rx="4"/><rect x="36" y="36" width="18" height="18" rx="4"/></svg>';
function buildCats() {   // the round coloured category buttons above the listings
  $("tiles").innerHTML = `<button class="tile c8 ${!activeCat ? "on" : ""}" data-c=""><span>${ALLICON}</span>All</button>` +
    CATS.map(c => `<button class="tile ${catClass(c)} ${activeCat === c ? "on" : ""}" data-c="${c}"><span>${icon(c)}</span>${c}</button>`).join("");
  $("hcat").value = activeCat;
}
function thumb(i) {
  return i.image_url ? `<img src="${clean(i.image_url)}" alt="${clean(i.title)}" loading="lazy">` : `<div class="ph ${catClass(i.category)}">${icon(i.category)}<span>${clean(i.category)}</span></div>`;
}
function card(i) {
  const mine = user && i.user_id === user.id;
  const sold = i.status === "sold", old = expired(i);
  const price = i.price === 0 ? "Free" : "₹" + i.price.toLocaleString("en-IN");
  const fresh = Date.now() - new Date(i.created_at) < 86400000 && i.approval === "approved" && !sold;
  let top = "", foot = "";
  if (view === "queue") {   // moderator review card
    top = '<span class="pill pending">Waiting for review</span>';
    foot = `<div class="check">Check: allowed item, clear photo, honest details, no phone numbers or links.</div>
      <button class="btn primary sm" data-do="approve" data-id="${i.id}">Approve</button>
      <button class="btn bad sm" data-do="reject" data-id="${i.id}">Reject</button>`;
  } else if (view === "mine") {
    if (i.approval === "pending") top = '<span class="pill pending">Waiting for approval</span>';
    if (i.approval === "approved") top = '<span class="pill approved">Live</span>';
    if (i.approval === "rejected") top = '<span class="pill rejected">Not approved: ' + clean(i.reject_reason || "see rules") + "</span>";
    if (i.approval === "approved" && old) foot = `<button class="btn primary sm" data-do="repost" data-id="${i.id}">Repost</button>`;
    else if (i.approval === "approved") foot = `<button class="btn ghost sm" data-do="sold" data-id="${i.id}">${sold ? "Reopen" : "Mark as sold"}</button>`;
    foot += `<button class="link" data-do="del" data-id="${i.id}">Delete</button>`;
  } else if (isMod) {
    foot = `<button class="link" data-do="del" data-id="${i.id}">Remove (mod)</button>`;
  }
  return `<article class="card ${catClass(i.category)} ${sold ? "sold" : ""}" data-open="${i.id}">
    <div class="thumb">${thumb(i)}${fresh ? '<span class="newtag">NEW</span>' : ""}
      ${view === "browse" && !mine ? `<button class="heart" data-do="save" data-id="${i.id}" aria-label="Save">${HEART(saved.includes(i.id))}</button>` : ""}
      ${sold ? '<span class="ribbon">SOLD</span>' : ""}</div>
    <div class="cbody">${top}<div class="price">${price}</div><h3>${clean(i.title)}</h3>
      <div class="meta"><span>${clean(i.pickup || "")}</span><span>${timeAgo(i.created_at)}</span></div><span class="cond-tag k${CONDS.indexOf(i.condition)}">${clean(i.condition)}</span>
      ${isMod && i.reports ? `<span class="flag">${i.reports} report${i.reports > 1 ? "s" : ""}</span>` : ""}</div>
    ${foot ? `<div class="cfoot">${foot}</div>` : ""}</article>`;
}
function passesFilters(i) {
  const q = $("q").value.toLowerCase().trim(), loc = $("ploc").value.toLowerCase().trim();
  const min = parseInt($("pmin").value, 10), max = parseInt($("pmax").value, 10);
  const conds = [...document.querySelectorAll(".cond:checked")].map(c => c.value);
  return (!activeCat || i.category === activeCat) &&
    (i.title + " " + i.description).toLowerCase().includes(q) &&
    (!loc || (i.pickup || "").toLowerCase().includes(loc)) &&
    (isNaN(min) || i.price >= min) && (isNaN(max) || i.price <= max) &&
    (!conds.length || conds.includes(i.condition)) &&
    (!$("onlySaved").checked || saved.includes(i.id));
}
function drawFeed() {
  const pending = items.filter(i => i.approval === "pending");
  $("tabQueue").hidden = !isMod; $("qn").textContent = pending.length; $("modTag").hidden = !isMod;
  document.querySelectorAll(".tabs [data-v]").forEach(b => b.classList.toggle("on", b.dataset.v === view));
  $("filters").style.visibility = view === "browse" ? "visible" : "hidden";
  $("heading").textContent = view === "mine" ? "My listings" : view === "queue" ? "Review queue" : activeCat || "Fresh listings";
  $("feed").classList.toggle("list", listMode);
  $("vGrid").classList.toggle("on", !listMode); $("vList").classList.toggle("on", listMode);
  buildCats();
  const passedOn = items.filter(i => i.approval === "approved" && i.status === "sold").length;
  let list, emptyMsg = "Nothing here yet.";
  if (view === "mine") { list = items.filter(i => user && i.user_id === user.id); emptyMsg = "You haven't posted anything yet. Click Sell to add your first item."; }
  else if (view === "queue") { list = pending; emptyMsg = "All caught up. Nothing is waiting for review."; }
  else { list = items.filter(i => onBoard(i) && passesFilters(i)); emptyMsg = "No results. Try different filters or another category."; }
  const order = $("sort").value;
  list.sort((a, b) => view === "browse" && order === "lo" ? a.price - b.price : view === "browse" && order === "hi" ? b.price - a.price : new Date(b.created_at) - new Date(a.created_at));
  const n = list.length + (list.length === 1 ? " listing" : " listings");
  $("info").textContent = view === "mine" ? n + " · " + myActive() + " of " + MAX_ACTIVE + " active posts used" : view === "queue" ? n + " waiting" : n + " · " + passedOn + " items passed on so far";
  $("feed").innerHTML = list.length ? list.map(card).join("") : `<div class="empty"><h3>Nothing to show</h3><p>${emptyMsg}</p></div>`;
}
async function refresh() {
  if (!items.length) $("feed").innerHTML = '<div class="empty">Loading listings...</div>';
  items = await loadListings();
  isMod = await findOutIfMod();
  if (view === "queue" && !isMod) view = "browse";
  $("who").textContent = user ? user.email : "";
  $("authBtn").textContent = user ? "Log out" : "Log in";
  drawFeed();
}

// the listing page (opens when you click a card)
function openDetail(id) {
  const i = items.find(x => x.id === id); if (!i) return;
  const mine = user && i.user_id === user.id, sold = i.status === "sold";
  $("dImg").className = "dimg " + catClass(i.category);
  $("dImg").innerHTML = i.image_url ? `<img src="${clean(i.image_url)}" alt="${clean(i.title)}">` : icon(i.category);
  $("dCrumb").textContent = "Home  ›  " + i.category;
  $("dPrice").textContent = i.price === 0 ? "Free" : "₹" + i.price.toLocaleString("en-IN");
  $("dTitle").textContent = i.title;
  $("dMeta").textContent = "Pickup: " + (i.pickup || "ask the seller") + " · posted " + timeAgo(i.created_at);
  $("dAv").textContent = nameOf(i.seller_email).charAt(0); $("dName").textContent = nameOf(i.seller_email);
  $("dDesc").textContent = i.description;
  $("dRows").innerHTML = `<dt>Condition</dt><dd>${clean(i.condition)}</dd><dt>Category</dt><dd>${clean(i.category)}</dd><dt>Pickup spot</dt><dd>${clean(i.pickup || "-")}</dd><dt>Status</dt><dd>${sold ? "Sold" : "Available"}</dd><dt>Listing ID</dt><dd>${clean(String(i.id).slice(0, 8))}</dd>`;
  $("dReveal").hidden = true;
  $("dEmail").textContent = i.seller_email || "";
  $("dMail").href = "mailto:" + (i.seller_email || "") + "?subject=" + encodeURIComponent("PassItOn: " + i.title) +
    "&body=" + encodeURIComponent('Hi, is "' + i.title + '" (₹' + i.price + ") still available? Can we meet at " + (i.pickup || "a campus spot") + "?");
  if (mine) $("dActions").innerHTML = '<p class="mu">This is your listing.</p>';
  else $("dActions").innerHTML = (sold ? '<button class="btn ghost block" disabled>No longer available</button>' : '<button class="btn primary block" id="dContact">' + (user ? "Contact seller" : "Log in to contact seller") + "</button>") +
    `<p><button class="textbtn" data-do="save" data-id="${i.id}">${saved.includes(i.id) ? "Saved (click to remove)" : "Save for later"}</button> · <button class="textbtn" data-do="report" data-id="${i.id}">Report this listing</button></p>`;
  if ($("dContact")) $("dContact").onclick = () => {
    if (!user) { $("detailD").close(); openLogin("Log in with your college email to contact sellers."); return; }
    $("dReveal").hidden = false; $("dContact").hidden = true;
  };
  $("detailD").showModal();
}

// ---------- 7. BUTTONS ----------
document.querySelectorAll(".close").forEach(b => b.onclick = () => b.closest("dialog").close());
$("ca").innerHTML = CATS.map(c => `<option>${c}</option>`).join("");
$("hcat").innerHTML = '<option value="">All categories</option>' + CATS.map(c => `<option>${c}</option>`).join("");
$("adm").textContent = C.ADMIN;
["q", "sort", "onlySaved", "pmin", "pmax", "ploc"].forEach(id => $(id).oninput = drawFeed);
document.querySelectorAll(".cond").forEach(c => c.onchange = drawFeed);
$("reset").onclick = () => { ["q", "pmin", "pmax", "ploc"].forEach(id => $(id).value = ""); $("onlySaved").checked = false; $("sort").value = "new"; activeCat = ""; document.querySelectorAll(".cond").forEach(c => c.checked = false); drawFeed(); };
$("filtBtn").onclick = () => $("filters").classList.toggle("open");
$("vGrid").onclick = () => { listMode = false; localStorage.setItem("pio_list", "0"); drawFeed(); };
$("vList").onclick = () => { listMode = true; localStorage.setItem("pio_list", "1"); drawFeed(); };
$("helpBtn").onclick = $("helpLink2").onclick = () => $("helpD").showModal();
$("go").onclick = () => { view = "browse"; drawFeed(); $("tiles").scrollIntoView({ behavior: "smooth" }); };
$("q").onkeydown = e => { if (e.key === "Enter") $("go").click(); };
$("hcat").onchange = () => { activeCat = $("hcat").value; view = "browse"; drawFeed(); };
$("tiles").onclick = e => { const b = e.target.closest("button"); if (!b) return; activeCat = b.dataset.c; view = "browse"; drawFeed(); };
document.querySelector(".tabs").onclick = e => { const b = e.target.closest("[data-v]"); if (!b) return; if (!user && b.dataset.v !== "browse") { openLogin("Log in to see your listings."); return; } view = b.dataset.v; drawFeed(); };

// login
function openLogin(why) {
  $("authWhy").textContent = why || ""; $("authWhy").hidden = !why;
  $("step1").hidden = false; $("step2").hidden = true; $("mailBox").hidden = true; $("aerr").textContent = ""; $("authD").showModal();
}
$("authBtn").onclick = () => { if (user) logout(); else openLogin(""); };
async function doSend() {
  const email = $("em").value.trim().toLowerCase();
  if (!email.endsWith("@" + C.DOMAIN)) { $("aerr").textContent = "Use your @" + C.DOMAIN + " email."; return; }
  if (Date.now() - lastSend < 30000) { $("aerr").textContent = "Please wait 30 seconds before asking again."; return; }
  lastSend = Date.now();
  const err = await sendCode(email);
  if (err) { $("aerr").textContent = err; return; }
  $("step1").hidden = true; $("step2").hidden = false; $("aerr").textContent = "";
}
$("send").onclick = doSend; $("resend").onclick = doSend;
$("verify").onclick = async () => {
  const err = await checkCode($("em").value.trim().toLowerCase(), $("otp").value.trim());
  if (err) { $("aerr").textContent = err; return; }
  $("authD").close(); say("You're logged in.");
  if (DEMO) await refresh();   // (real mode refreshes by itself when Supabase says we're logged in)
};

// posting
$("postBtn").onclick = () => {
  if (!user) { openLogin("Log in with your college email to sell something."); return; }
  $("perr").textContent = ""; $("postD").showModal();
};
function shrink(file) {   // shrink the photo in the browser so uploads stay small
  return new Promise(done => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 700 / img.width), c = document.createElement("canvas");
      c.width = img.width * k; c.height = img.height * k;
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      done(c.toDataURL("image/jpeg", 0.7));
    };
    img.src = URL.createObjectURL(file);
  });
}
$("ph").onchange = async e => {
  if (!e.target.files[0]) return;
  photo = await shrink(e.target.files[0]); $("prev").src = photo; $("prev").hidden = false;
};
$("submit").onclick = async () => {
  const item = { title: $("ti").value.trim(), category: $("ca").value, price: parseInt($("pr").value, 10), condition: $("co").value, pickup: $("pk").value.trim(), description: $("de").value.trim() };
  const problem = checkPost(item, photo);
  if (problem) { $("perr").textContent = problem; return; }
  $("submit").disabled = true;
  const err = await saveListing(item, photo);
  $("submit").disabled = false;
  if (err) { $("perr").textContent = err; return; }
  ["ti", "pr", "pk", "de", "ph"].forEach(id => $(id).value = ""); $("agree").checked = false; photo = null; $("prev").hidden = true;
  $("postD").close(); say("Sent for approval. A moderator will check it soon. You can track it in My listings.");
  view = "mine"; await refresh();
};

// clicks on cards and on the listing page
async function handleAction(b) {
  const id = b.dataset.id, what = b.dataset.do, it = items.find(x => x.id === id);
  if (what === "save") { saved = saved.includes(id) ? saved.filter(x => x !== id) : [...saved, id]; localStorage.setItem("pio_saved", JSON.stringify(saved)); drawFeed(); if ($("detailD").open) openDetail(id); }
  if (what === "approve") { await changeListing(id, { approval: "approved", reject_reason: null }); say("Approved. It's live on the board now."); await refresh(); }
  if (what === "reject") { openId = id; $("rejD").showModal(); }
  if (what === "sold") { const nowSold = it.status !== "sold"; await changeListing(id, { status: nowSold ? "sold" : "available" }); say(nowSold ? "Marked as sold. One more item reused!" : "Listing reopened."); await refresh(); }
  if (what === "repost") { await changeListing(id, { created_at: new Date().toISOString() }); say("Reposted for another " + EXPIRE_DAYS + " days."); await refresh(); }
  if (what === "del" && confirm("Delete this listing?")) { await removeListing(id); say("Listing deleted."); await refresh(); }
  if (what === "report") { $("detailD").close(); if (!user) { openLogin("Log in to report a listing."); return; } openId = id; $("repD").showModal(); }
}
$("feed").onclick = e => {
  const b = e.target.closest("[data-do]");
  if (b) { handleAction(b); return; }
  const c = e.target.closest("[data-open]");
  if (c) openDetail(c.dataset.open);
};
$("dActions").onclick = e => { const b = e.target.closest("[data-do]"); if (b) handleAction(b); };
$("rSend").onclick = async () => {
  const ok = await reportListing(openId, $("rSel").value);
  $("repD").close(); say(ok ? "Thanks, we've got your report." : "You already reported this listing."); await refresh();
};
$("jSend").onclick = async () => {
  await changeListing(openId, { approval: "rejected", reject_reason: $("jSel").value });
  $("rejD").close(); say("Rejected. The seller will see your reason."); await refresh();
};

// ---------- 8. START ----------
async function start() {
  if (DEMO) {
    user = store("pio_user");
  } else {
    const s = await sb.auth.getSession();
    if (s.data.session) user = { id: s.data.session.user.id, email: s.data.session.user.email };
    sb.auth.onAuthStateChange((event, session) => {
      user = session ? { id: session.user.id, email: session.user.email } : null;
      refresh();
    });
  }
  await refresh();
}
start();
