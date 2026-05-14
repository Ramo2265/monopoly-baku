const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, 'public')));

// ===== GAME ROOMS =====
const rooms = {};

function createRoom(code) {
  return {
    code,
    players: [],
    started: false,
    currentPlayer: 0,
    phase: "wait",
    doubles: 0,
    lastDice: [0, 0],
    chanceIdx: 0,
    communityIdx: 0,
    chanceOrder: shuffle([...Array(16).keys()]),
    communityOrder: shuffle([...Array(14).keys()]),
    properties: {},
    houses: {},
    freeParking: 0
  };
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ===== BOARD DATA =====
const CELLS = [
  { id: 0, name: "START", type: "go", icon: "🚀" },
  { id: 1, name: "Buzovna", type: "prop", price: 60, rent: [2, 10, 30, 90, 160, 250], color: "#8B4513", group: "brown", hcost: 50, icon: "🏘️" },
  { id: 2, name: "Şans", type: "chance", icon: "❓" },
  { id: 3, name: "Mərdəkan", type: "prop", price: 60, rent: [4, 20, 60, 180, 320, 450], color: "#8B4513", group: "brown", hcost: 50, icon: "🏖️" },
  { id: 4, name: "Vergi", type: "tax", amount: 200, icon: "💰" },
  { id: 5, name: "Metro 28 May", type: "rail", price: 200, icon: "🚇" },
  { id: 6, name: "Binəqədi", type: "prop", price: 100, rent: [6, 30, 90, 270, 400, 550], color: "#87CEEB", group: "lblue", hcost: 50, icon: "🏗️" },
  { id: 7, name: "İcma Sandığı", type: "community", icon: "📦" },
  { id: 8, name: "Sabunçu", type: "prop", price: 100, rent: [6, 30, 90, 270, 400, 550], color: "#87CEEB", group: "lblue", hcost: 50, icon: "🏭" },
  { id: 9, name: "Zabrat", type: "prop", price: 120, rent: [8, 40, 100, 300, 450, 600], color: "#87CEEB", group: "lblue", hcost: 50, icon: "🏘️" },
  { id: 10, name: "HƏBS", type: "jail", icon: "🔒" },
  { id: 11, name: "Xətai", type: "prop", price: 140, rent: [10, 50, 150, 450, 625, 750], color: "#FF69B4", group: "pink", hcost: 100, icon: "🏢" },
  { id: 12, name: "SOCAR Elektrik", type: "util", price: 150, icon: "⚡" },
  { id: 13, name: "Nərimanov", type: "prop", price: 140, rent: [10, 50, 150, 450, 625, 750], color: "#FF69B4", group: "pink", hcost: 100, icon: "🏬" },
  { id: 14, name: "H.Aslanov", type: "prop", price: 160, rent: [12, 60, 180, 500, 700, 900], color: "#FF69B4", group: "pink", hcost: 100, icon: "🏠" },
  { id: 15, name: "Metro Gənclik", type: "rail", price: 200, icon: "🚇" },
  { id: 16, name: "Yasamal", type: "prop", price: 180, rent: [14, 70, 200, 550, 750, 950], color: "#FFA500", group: "orange", hcost: 100, icon: "🏘️" },
  { id: 17, name: "İcma Sandığı", type: "community", icon: "📦" },
  { id: 18, name: "Nəsimi", type: "prop", price: 180, rent: [14, 70, 200, 550, 750, 950], color: "#FFA500", group: "orange", hcost: 100, icon: "🏙️" },
  { id: 19, name: "Səbail", type: "prop", price: 200, rent: [16, 80, 220, 600, 800, 1000], color: "#FFA500", group: "orange", hcost: 100, icon: "⛵" },
  { id: 20, name: "PULSUZ PARK", type: "free", icon: "🅿️" },
  { id: 21, name: "Nizami küçəsi", type: "prop", price: 220, rent: [18, 90, 250, 700, 875, 1050], color: "#FF0000", group: "red", hcost: 150, icon: "🛍️" },
  { id: 22, name: "Şans", type: "chance", icon: "❓" },
  { id: 23, name: "Torqovı", type: "prop", price: 220, rent: [18, 90, 250, 700, 875, 1050], color: "#FF0000", group: "red", hcost: 150, icon: "🏪" },
  { id: 24, name: "Fəvvarələr Meydanı", type: "prop", price: 240, rent: [20, 100, 300, 750, 925, 1100], color: "#FF0000", group: "red", hcost: 150, icon: "⛲" },
  { id: 25, name: "Metro Nəsimi", type: "rail", price: 200, icon: "🚇" },
  { id: 26, name: "Bulvar", type: "prop", price: 260, rent: [22, 110, 330, 800, 975, 1150], color: "#FFD700", group: "yellow", hcost: 150, icon: "🌊" },
  { id: 27, name: "Bulvar Park", type: "prop", price: 260, rent: [22, 110, 330, 800, 975, 1150], color: "#FFD700", group: "yellow", hcost: 150, icon: "🌳" },
  { id: 28, name: "Azərsu", type: "util", price: 150, icon: "💧" },
  { id: 29, name: "Ağ Şəhər", type: "prop", price: 280, rent: [24, 120, 360, 850, 1025, 1200], color: "#FFD700", group: "yellow", hcost: 150, icon: "🏙️" },
  { id: 30, name: "HƏBSƏ GET", type: "gotojail", icon: "🚔" },
  { id: 31, name: "Flame Towers", type: "prop", price: 300, rent: [26, 130, 390, 900, 1100, 1275], color: "#00CC00", group: "green", hcost: 200, icon: "🔥" },
  { id: 32, name: "İcma Sandığı", type: "community", icon: "📦" },
  { id: 33, name: "H.Əliyev Mərkəzi", type: "prop", price: 300, rent: [26, 130, 390, 900, 1100, 1275], color: "#00CC00", group: "green", hcost: 200, icon: "🏛️" },
  { id: 34, name: "Metro İçərişəhər", type: "rail", price: 200, icon: "🚇" },
  { id: 35, name: "Şans", type: "chance", icon: "❓" },
  { id: 36, name: "Qız Qalası", type: "prop", price: 350, rent: [35, 175, 500, 1100, 1300, 1500], color: "#0000CC", group: "blue", hcost: 200, icon: "🏰" },
  { id: 37, name: "Lüks Vergi", type: "tax", amount: 100, icon: "💎" },
  { id: 38, name: "İçərişəhər", type: "prop", price: 320, rent: [28, 150, 450, 1000, 1200, 1400], color: "#00CC00", group: "green", hcost: 200, icon: "🕌" },
  { id: 39, name: "Şirvanşahlar Sarayı", type: "prop", price: 400, rent: [50, 200, 600, 1400, 1700, 2000], color: "#0000CC", group: "blue", hcost: 200, icon: "👑" }
];

const CHANCE = [
  { t: "START-a qayıt, 200₼ al!", a: "goto", v: 0 },
  { t: "Flame Towers-ə get!", a: "goto", v: 31 },
  { t: "Fəvvarələr Meydanına get!", a: "goto", v: 24 },
  { t: "Bulvara get!", a: "goto", v: 26 },
  { t: "Nizami küçəsinə get!", a: "goto", v: 21 },
  { t: "Ən yaxın Metroya get!", a: "next_rail", v: 0 },
  { t: "3 addım geri get.", a: "back3", v: 0 },
  { t: "Həbsə düş!", a: "jail", v: 0 },
  { t: "Həbsdən azad kartı!", a: "jailcard", v: 0 },
  { t: "Lotereya - 150₼!", a: "get", v: 150 },
  { t: "Bank dividendi - 50₼!", a: "get", v: 50 },
  { t: "Neft gəliri - 200₼!", a: "get", v: 200 },
  { t: "Jazz Festival - 100₼!", a: "get", v: 100 },
  { t: "Yol vergisi - 150₼ ödə.", a: "pay", v: 150 },
  { t: "Təmir - 50₼ ödə.", a: "pay", v: 50 },
  { t: "Hər oyunçuya 50₼ ödə.", a: "payeach", v: 50 }
];

const COMMUNITY = [
  { t: "Bank xətası - 200₼ al!", a: "get", v: 200 },
  { t: "START-a qayıt, 200₼ al!", a: "goto", v: 0 },
  { t: "Sığorta - 100₼ al.", a: "get", v: 100 },
  { t: "Miras - 100₼ al.", a: "get", v: 100 },
  { t: "Vergi qaytarması - 20₼.", a: "get", v: 20 },
  { t: "Ad günün - 10₼!", a: "get", v: 10 },
  { t: "Toy hədiyyəsi - 25₼.", a: "get", v: 25 },
  { t: "Həbsdən azad kartı!", a: "jailcard", v: 0 },
  { t: "Həbsə düş!", a: "jail", v: 0 },
  { t: "Həkim - 50₼ ödə.", a: "pay", v: 50 },
  { t: "Məktəb - 50₼ ödə.", a: "pay", v: 50 },
  { t: "Xəstəxana - 100₼ ödə.", a: "pay", v: 100 },
  { t: "Təmir: hər ev 40₼, hotel 115₼.", a: "repairs", v: [40, 115] },
  { t: "Hər oyunçudan 10₼ al!", a: "geteach", v: 10 }
];

const PCOLORS = ["#e94560", "#3498db", "#2ecc71", "#f39c12"];
const PTOKENS = ["🔴", "🔵", "🟢", "🟡"];

// ===== GAME LOGIC =====
function groupCells(gr) { return CELLS.filter(c => c.group === gr); }
function ownsGroup(room, pid, gr) {
  const gc = groupCells(gr);
  return gc.every(c => room.properties[c.id] === pid);
}

function calcRent(room, cell, ownerIdx) {
  const owner = room.players[ownerIdx];
  if (cell.type === 'rail') {
    const n = Object.entries(room.properties).filter(([id, oi]) => oi === ownerIdx && CELLS[id].type === 'rail').length;
    return 25 * Math.pow(2, n - 1);
  }
  if (cell.type === 'util') {
    const n = Object.entries(room.properties).filter(([id, oi]) => oi === ownerIdx && CELLS[id].type === 'util').length;
    const dsum = room.lastDice[0] + room.lastDice[1];
    return dsum * (n === 2 ? 10 : 4);
  }
  const h = room.houses[cell.id] || 0;
  if (h === 0 && ownsGroup(room, ownerIdx, cell.group)) return cell.rent[0] * 2;
  return cell.rent[h];
}

function getState(room) {
  return {
    code: room.code,
    players: room.players,
    currentPlayer: room.currentPlayer,
    phase: room.phase,
    properties: room.properties,
    houses: room.houses,
    lastDice: room.lastDice,
    started: room.started
  };
}

function nextPlayer(room) {
  let next = (room.currentPlayer + 1) % room.players.length;
  let s = 0;
  while (room.players[next].dead && s < 10) { next = (next + 1) % room.players.length; s++; }
  room.currentPlayer = next;
  room.phase = "roll";
  room.doubles = 0;
}

function moveAndLand(room, player, steps) {
  const old = player.pos;
  const nw = (old + steps) % 40;
  const logs = [];

  if (nw < old) {
    player.money += 200;
    logs.push({ t: "🚀 " + player.name + " START-dan keçdi +200₼" });
  }
  player.pos = nw;
  const cell = CELLS[nw];
  logs.push({ t: "📍 " + player.name + " → " + cell.name });

  const result = handleLanding(room, player, cell, logs);
  return { logs, ...result };
}

function handleLanding(room, player, cell, logs) {
  const pidx = room.players.indexOf(player);

  switch (cell.type) {
    case 'prop': case 'rail': case 'util': {
      const ownerIdx = room.properties[cell.id];
      if (ownerIdx === undefined) {
        return { action: "offer_buy", cellId: cell.id };
      } else if (ownerIdx === pidx) {
        return { action: "own_property" };
      } else if (room.players[ownerIdx].jail) {
        logs.push({ t: "🔒 Sahib həbsdədir, kirayə yoxdur." });
        return { action: "none" };
      } else {
        const rent = calcRent(room, cell, ownerIdx);
        player.money -= rent;
        room.players[ownerIdx].money += rent;
        logs.push({ t: "💸 " + player.name + " → " + room.players[ownerIdx].name + " " + rent + "₼ kirayə" });
        if (player.money < 0) return { action: "bankrupt_risk" };
        return { action: "none" };
      }
    }
    case 'tax': {
      player.money -= cell.amount;
      logs.push({ t: "💰 " + player.name + " " + cell.amount + "₼ vergi ödədi" });
      if (player.money < 0) return { action: "bankrupt_risk" };
      return { action: "none" };
    }
    case 'gotojail': {
      player.pos = 10;
      player.jail = true;
      player.jailTurns = 0;
      room.doubles = 0;
      logs.push({ t: "🔒 " + player.name + " həbsə düşdü!" });
      return { action: "jailed" };
    }
    case 'chance': {
      const ci = room.chanceOrder[room.chanceIdx % room.chanceOrder.length];
      room.chanceIdx++;
      const card = CHANCE[ci];
      logs.push({ t: "❓ Şans: " + card.t });
      return executeCard(room, player, card, logs, "chance");
    }
    case 'community': {
      const ci = room.communityOrder[room.communityIdx % room.communityOrder.length];
      room.communityIdx++;
      const card = COMMUNITY[ci];
      logs.push({ t: "📦 İcma: " + card.t });
      return executeCard(room, player, card, logs, "community");
    }
    default:
      return { action: "none" };
  }
}

function executeCard(room, player, card, logs, cardType) {
  const pidx = room.players.indexOf(player);
  switch (card.a) {
    case 'get': player.money += card.v; return { action: "none", card: { type: cardType, text: card.t } };
    case 'pay':
      player.money -= card.v;
      if (player.money < 0) return { action: "bankrupt_risk", card: { type: cardType, text: card.t } };
      return { action: "none", card: { type: cardType, text: card.t } };
    case 'goto': {
      const old = player.pos;
      if (card.v < old && card.v !== 10) { player.money += 200; logs.push({ t: "🚀 START +200₼" }); }
      player.pos = card.v;
      const result = handleLanding(room, player, CELLS[card.v], logs);
      return { ...result, card: { type: cardType, text: card.t } };
    }
    case 'jail':
      player.pos = 10; player.jail = true; player.jailTurns = 0;
      return { action: "jailed", card: { type: cardType, text: card.t } };
    case 'jailcard':
      player.jailFree = (player.jailFree || 0) + 1;
      return { action: "none", card: { type: cardType, text: card.t } };
    case 'back3':
      player.pos = (player.pos - 3 + 40) % 40;
      const r = handleLanding(room, player, CELLS[player.pos], logs);
      return { ...r, card: { type: cardType, text: card.t } };
    case 'next_rail': {
      let p = player.pos;
      do { p = (p + 1) % 40; } while (CELLS[p].type !== 'rail');
      const old2 = player.pos;
      if (p < old2) { player.money += 200; }
      player.pos = p;
      const oi = room.properties[p];
      if (oi !== undefined && oi !== pidx) {
        const rent = calcRent(room, CELLS[p], oi) * 2;
        player.money -= rent; room.players[oi].money += rent;
        logs.push({ t: "💸 2x metro kirayə: " + rent + "₼" });
      }
      if (oi === undefined) return { action: "offer_buy", cellId: p, card: { type: cardType, text: card.t } };
      return { action: "none", card: { type: cardType, text: card.t } };
    }
    case 'payeach':
      room.players.forEach((o, i) => { if (i !== pidx && !o.dead) { player.money -= card.v; o.money += card.v; } });
      if (player.money < 0) return { action: "bankrupt_risk", card: { type: cardType, text: card.t } };
      return { action: "none", card: { type: cardType, text: card.t } };
    case 'geteach':
      room.players.forEach((o, i) => { if (i !== pidx && !o.dead) { o.money -= card.v; player.money += card.v; } });
      return { action: "none", card: { type: cardType, text: card.t } };
    case 'repairs': {
      let tot = 0;
      Object.entries(room.houses).forEach(([id, h]) => {
        if (room.properties[id] === pidx) {
          if (h === 5) tot += card.v[1]; else tot += h * card.v[0];
        }
      });
      player.money -= tot;
      if (tot > 0) logs.push({ t: "🔧 Təmir: " + tot + "₼" });
      if (player.money < 0) return { action: "bankrupt_risk", card: { type: cardType, text: card.t } };
      return { action: "none", card: { type: cardType, text: card.t } };
    }
    default: return { action: "none", card: { type: cardType, text: card.t } };
  }
}

function getBuildable(room, pidx) {
  const player = room.players[pidx];
  const res = [];
  const myProps = Object.entries(room.properties).filter(([id, oi]) => oi === pidx).map(([id]) => parseInt(id));
  const groups = {};
  myProps.forEach(id => { const c = CELLS[id]; if (c.group) { if (!groups[c.group]) groups[c.group] = []; groups[c.group].push(id); } });
  Object.keys(groups).forEach(gr => {
    const gc = groupCells(gr);
    if (groups[gr].length === gc.length) {
      groups[gr].forEach(id => {
        const h = room.houses[id] || 0;
        if (h < 5 && player.money >= CELLS[id].hcost) {
          res.push({ id, h, cost: CELLS[id].hcost });
        }
      });
    }
  });
  return res;
}

// ===== SOCKET HANDLERS =====
io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('create_room', (data) => {
    const code = generateCode();
    const room = createRoom(code);
    room.players.push({
      id: socket.id,
      name: data.name || 'Oyunçu 1',
      money: 1500,
      pos: 0,
      jail: false,
      jailTurns: 0,
      jailFree: 0,
      dead: false,
      color: PCOLORS[0],
      token: PTOKENS[0],
      idx: 0
    });
    rooms[code] = room;
    socket.join(code);
    socket.roomCode = code;
    socket.playerIdx = 0;
    socket.emit('room_created', { code, state: getState(room), you: 0 });
    console.log('Room created:', code);
  });

  socket.on('join_room', (data) => {
    const code = data.code.toUpperCase();
    const room = rooms[code];
    if (!room) { socket.emit('error_msg', 'Otaq tapılmadı!'); return; }
    if (room.started) { socket.emit('error_msg', 'Oyun artıq başlayıb!'); return; }
    if (room.players.length >= 4) { socket.emit('error_msg', 'Otaq doludur!'); return; }

    const idx = room.players.length;
    room.players.push({
      id: socket.id,
      name: data.name || ('Oyunçu ' + (idx + 1)),
      money: 1500,
      pos: 0,
      jail: false,
      jailTurns: 0,
      jailFree: 0,
      dead: false,
      color: PCOLORS[idx],
      token: PTOKENS[idx],
      idx
    });
    socket.join(code);
    socket.roomCode = code;
    socket.playerIdx = idx;
    socket.emit('room_joined', { code, state: getState(room), you: idx });
    io.to(code).emit('update', { state: getState(room), log: { t: "👋 " + room.players[idx].name + " qoşuldu! (" + room.players.length + "/4)" } });
    console.log(data.name, 'joined', code);
  });

  socket.on('start_game', () => {
    const room = rooms[socket.roomCode];
    if (!room || room.players.length < 2) { socket.emit('error_msg', 'Minimum 2 oyunçu lazımdır!'); return; }
    if (socket.playerIdx !== 0) { socket.emit('error_msg', 'Yalnız otaq sahibi başlada bilər!'); return; }
    room.started = true;
    room.phase = "roll";
    room.currentPlayer = 0;
    io.to(room.code).emit('game_started', { state: getState(room) });
    io.to(room.code).emit('update', { state: getState(room), log: { t: "🎮 Oyun başladı! " + room.players[0].name + " zər atsın!" } });
  });

  socket.on('roll_dice', () => {
    const room = rooms[socket.roomCode];
    if (!room || !room.started) return;
    if (socket.playerIdx !== room.currentPlayer) { socket.emit('error_msg', 'Sənin növbən deyil!'); return; }
    if (room.phase !== 'roll') { socket.emit('error_msg', 'İndi zər ata bilməzsən!'); return; }

    const player = room.players[room.currentPlayer];

    if (player.jail) {
      // Jail roll
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      room.lastDice = [d1, d2];

      if (d1 === d2) {
        player.jail = false;
        player.jailTurns = 0;
        const result = moveAndLand(room, player, d1 + d2);
        const logs = [{ t: "🎲 " + player.name + " " + d1 + "+" + d2 + " (CÜT! Həbsdən çıxdı!)" }, ...result.logs];
        if (result.action === 'offer_buy') {
          room.phase = 'buy';
          room.pendingBuy = result.cellId;
        } else if (result.action === 'jailed' || result.action === 'bankrupt_risk') {
          room.phase = 'endturn';
        } else {
          room.phase = 'endturn';
        }
        io.to(room.code).emit('dice_result', { dice: [d1, d2], state: getState(room), logs, card: result.card });
      } else {
        player.jailTurns++;
        if (player.jailTurns >= 3) {
          player.jail = false;
          player.jailTurns = 0;
          player.money -= 50;
          const result = moveAndLand(room, player, d1 + d2);
          const logs = [{ t: "🎲 " + player.name + " " + d1 + "+" + d2 + " - 3 növbə doldu, 50₼ ödəyib çıxdı" }, ...result.logs];
          if (result.action === 'offer_buy') { room.phase = 'buy'; room.pendingBuy = result.cellId; }
          else { room.phase = 'endturn'; }
          io.to(room.code).emit('dice_result', { dice: [d1, d2], state: getState(room), logs, card: result.card });
        } else {
          room.phase = 'endturn';
          io.to(room.code).emit('dice_result', {
            dice: [d1, d2], state: getState(room),
            logs: [{ t: "🎲 " + player.name + " " + d1 + "+" + d2 + " - Həbsdə qaldı (" + player.jailTurns + "/3)" }]
          });
        }
      }
      return;
    }

    // Normal roll
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    room.lastDice = [d1, d2];
    const dbl = d1 === d2;

    if (dbl) {
      room.doubles++;
      if (room.doubles >= 3) {
        player.pos = 10; player.jail = true; player.jailTurns = 0; room.doubles = 0;
        room.phase = 'endturn';
        io.to(room.code).emit('dice_result', {
          dice: [d1, d2], state: getState(room),
          logs: [{ t: "🎲 " + player.name + " 3x CÜT → Həbsə!" }]
        });
        return;
      }
    } else {
      room.doubles = 0;
    }

    const result = moveAndLand(room, player, d1 + d2);
    const logs = [{ t: "🎲 " + player.name + " " + d1 + "+" + d2 + "=" + (d1 + d2) + (dbl ? " (CÜT!)" : "") }, ...result.logs];

    if (result.action === 'offer_buy') {
      room.phase = 'buy';
      room.pendingBuy = result.cellId;
    } else if (result.action === 'jailed') {
      room.phase = 'endturn';
    } else if (result.action === 'bankrupt_risk') {
      if (Object.entries(room.properties).some(([id, oi]) => oi === room.currentPlayer)) {
        room.phase = 'must_sell';
      } else {
        player.dead = true;
        logs.push({ t: "💀 " + player.name + " İFLAS ETDİ!" });
        // Clean props
        Object.keys(room.properties).forEach(id => { if (room.properties[id] === room.currentPlayer) { delete room.properties[id]; delete room.houses[id]; } });
        room.phase = 'endturn';
        const alive = room.players.filter(p => !p.dead);
        if (alive.length === 1) {
          room.phase = 'gameover';
          room.winner = alive[0].idx;
        }
      }
    } else {
      if (dbl && !player.jail) room.phase = 'roll';
      else room.phase = 'endturn';
    }

    io.to(room.code).emit('dice_result', { dice: [d1, d2], state: getState(room), logs, card: result.card });
  });

  socket.on('buy_property', () => {
    const room = rooms[socket.roomCode];
    if (!room || socket.playerIdx !== room.currentPlayer || room.phase !== 'buy') return;
    const player = room.players[room.currentPlayer];
    const cellId = room.pendingBuy;
    const cell = CELLS[cellId];

    if (player.money >= cell.price) {
      player.money -= cell.price;
      room.properties[cellId] = room.currentPlayer;
      room.phase = 'endturn';
      const logs = [{ t: "🏠 " + player.name + " " + cell.name + " aldı! (" + cell.price + "₼)" }];
      if (cell.group && ownsGroup(room, room.currentPlayer, cell.group)) {
        logs.push({ t: "🎉 " + cell.group + " qrupu tamamlandı! 2x kirayə + ev tikə bilər!" });
      }
      io.to(room.code).emit('update', { state: getState(room), logs });
    }
  });

  socket.on('skip_buy', () => {
    const room = rooms[socket.roomCode];
    if (!room || socket.playerIdx !== room.currentPlayer || room.phase !== 'buy') return;
    room.phase = 'endturn';
    io.to(room.code).emit('update', { state: getState(room), logs: [{ t: room.players[room.currentPlayer].name + " almadı." }] });
  });

  socket.on('build_house', (data) => {
    const room = rooms[socket.roomCode];
    if (!room || socket.playerIdx !== room.currentPlayer) return;
    if (room.phase !== 'roll' && room.phase !== 'endturn') return;

    const player = room.players[room.currentPlayer];
    const cellId = data.cellId;
    const cell = CELLS[cellId];

    if (room.properties[cellId] !== room.currentPlayer) return;
    if (!cell.group || !ownsGroup(room, room.currentPlayer, cell.group)) return;

    const h = room.houses[cellId] || 0;
    if (h >= 5) return;
    if (player.money < cell.hcost) return;

    room.houses[cellId] = h + 1;
    player.money -= cell.hcost;
    const nh = room.houses[cellId];
    io.to(room.code).emit('update', {
      state: getState(room),
      logs: [{ t: "🏗️ " + player.name + " " + cell.name + " → " + (nh === 5 ? "Hotel" : nh + " ev") + " (" + cell.hcost + "₼)" }]
    });
  });

  socket.on('sell_property', (data) => {
    const room = rooms[socket.roomCode];
    if (!room || socket.playerIdx !== room.currentPlayer) return;
    const cellId = data.cellId;
    if (room.properties[cellId] !== room.currentPlayer) return;
    if (room.houses[cellId] && room.houses[cellId] > 0) return;

    const cell = CELLS[cellId];
    const player = room.players[room.currentPlayer];
    const sp = Math.floor(cell.price / 2);
    player.money += sp;
    delete room.properties[cellId];
    delete room.houses[cellId];
    const logs = [{ t: "💲 " + player.name + " " + cell.name + " satdı (+" + sp + "₼)" }];

    if (room.phase === 'must_sell' && player.money >= 0) {
      room.phase = 'endturn';
      logs.push({ t: "✅ Borc ödəndi!" });
    }
    io.to(room.code).emit('update', { state: getState(room), logs });
  });

  socket.on('sell_house', (data) => {
    const room = rooms[socket.roomCode];
    if (!room || socket.playerIdx !== room.currentPlayer) return;
    const cellId = data.cellId;
    if (room.properties[cellId] !== room.currentPlayer) return;
    if (!room.houses[cellId] || room.houses[cellId] <= 0) return;

    const cell = CELLS[cellId];
    const player = room.players[room.currentPlayer];
    const refund = Math.floor(cell.hcost / 2);
    room.houses[cellId]--;
    player.money += refund;
    const logs = [{ t: "🔨 " + player.name + " " + cell.name + " ev söküldü (+" + refund + "₼)" }];

    if (room.phase === 'must_sell' && player.money >= 0) {
      room.phase = 'endturn';
      logs.push({ t: "✅ Borc ödəndi!" });
    }
    io.to(room.code).emit('update', { state: getState(room), logs });
  });

  socket.on('pay_jail', () => {
    const room = rooms[socket.roomCode];
    if (!room || socket.playerIdx !== room.currentPlayer) return;
    const player = room.players[room.currentPlayer];
    if (!player.jail || player.money < 50) return;
    player.money -= 50;
    player.jail = false;
    player.jailTurns = 0;
    room.phase = 'roll';
    io.to(room.code).emit('update', { state: getState(room), logs: [{ t: "💰 " + player.name + " 50₼ ödəyib həbsdən çıxdı!" }] });
  });

  socket.on('use_jail_card', () => {
    const room = rooms[socket.roomCode];
    if (!room || socket.playerIdx !== room.currentPlayer) return;
    const player = room.players[room.currentPlayer];
    if (!player.jail || !player.jailFree) return;
    player.jailFree--;
    player.jail = false;
    player.jailTurns = 0;
    room.phase = 'roll';
    io.to(room.code).emit('update', { state: getState(room), logs: [{ t: "🎫 " + player.name + " azad kartı istifadə etdi!" }] });
  });

  socket.on('go_bankrupt', () => {
    const room = rooms[socket.roomCode];
    if (!room || socket.playerIdx !== room.currentPlayer) return;
    const player = room.players[room.currentPlayer];
    player.dead = true;
    Object.keys(room.properties).forEach(id => { if (room.properties[id] === room.currentPlayer) { delete room.properties[id]; delete room.houses[id]; } });
    const logs = [{ t: "💀 " + player.name + " İFLAS ETDİ!" }];
    const alive = room.players.filter(p => !p.dead);
    if (alive.length === 1) {
      room.phase = 'gameover';
      room.winner = alive[0].idx;
      logs.push({ t: "🏆 " + alive[0].name + " QAZANDI!" });
    } else {
      room.phase = 'endturn';
    }
    io.to(room.code).emit('update', { state: getState(room), logs });
  });

  socket.on('end_turn', () => {
    const room = rooms[socket.roomCode];
    if (!room || socket.playerIdx !== room.currentPlayer || room.phase !== 'endturn') return;
    nextPlayer(room);
    io.to(room.code).emit('update', {
      state: getState(room),
      logs: [{ t: "🔄 " + room.players[room.currentPlayer].name + "-in növbəsi!" }]
    });
  });

  socket.on('disconnect', () => {
    const code = socket.roomCode;
    if (code && rooms[code]) {
      const room = rooms[code];
      const pidx = socket.playerIdx;
      if (pidx !== undefined && room.players[pidx]) {
        room.players[pidx].dead = true;
        room.players[pidx].disconnected = true;
        io.to(code).emit('update', {
          state: getState(room),
          logs: [{ t: "🚪 " + room.players[pidx].name + " ayrıldı!" }]
        });
        const alive = room.players.filter(p => !p.dead);
        if (alive.length <= 1) {
          if (alive.length === 1) {
            room.phase = 'gameover';
            room.winner = alive[0].idx;
            io.to(code).emit('update', { state: getState(room), logs: [{ t: "🏆 " + alive[0].name + " QAZANDI!" }] });
          }
          setTimeout(() => { delete rooms[code]; }, 60000);
        } else if (room.currentPlayer === pidx) {
          nextPlayer(room);
          io.to(code).emit('update', { state: getState(room), logs: [{ t: "🔄 Növbə keçdi: " + room.players[room.currentPlayer].name }] });
        }
      }
    }
    console.log('Disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Monopoly Baku server running on port ${PORT}`);
});
