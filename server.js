const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const PORT = 3000;

app.use(express.static('public'));

let players = {};
let food = [];
const FOOD_AMOUNT = 300;
const MAP_SIZE = 3000;

function generateFood() {
  food = [];
  for (let i = 0; i < FOOD_AMOUNT; i++) {
    const types = ['normal', 'turbo', 'shield'];
    const type = Math.random() < 0.92 ? 'normal' : types[Math.floor(Math.random() * 2) + 1];
    food.push({
      id: i,
      x: Math.random() * MAP_SIZE,
      y: Math.random() * MAP_SIZE,
      size: type === 'normal' ? 5 + Math.random() * 5 : 10,
      type: type
    });
  }
}

function filterBadWords(message) {
  const badWords = ['merda', 'porra', 'caralho', 'fdp', 'filho da puta', 'puta', 'bosta'];
  let clean = message;
  badWords.forEach(word => {
    const regex = new RegExp(word, 'gi');
    clean = clean.replace(regex, '*'.repeat(word.length));
  });
  return clean;
}

generateFood();

io.on('connection', (socket) => {
  console.log(`🟢 Player connected: ${socket.id}`);

  players[socket.id] = {
    id: socket.id,
    name: `Player_${socket.id.substring(0, 4)}`,
    x: Math.random() * MAP_SIZE,
    y: Math.random() * MAP_SIZE,
    size: 10 + Math.random() * 5,
    color: `hsl(${Math.random() * 360}, 80%, 60%)`,
    turbo: 0,
    shield: 0,
    clan: '',
    xp: 0,
    level: 1,
    kills: 0,
    timeOnline: 0,
    missionsCompleted: 0,
    joinTime: Date.now()
  };

  socket.on('init', (name, clan) => {
    players[socket.id].name = name || players[socket.id].name;
    players[socket.id].clan = clan || '';
  });

  socket.on('update', (data) => {
    const p = players[socket.id];
    if (!p) return;

    p.x = Math.max(0, Math.min(MAP_SIZE, data.x));
    p.y = Math.max(0, Math.min(MAP_SIZE, data.y));

    food.forEach((f, i) => {
      const dx = p.x - f.x;
      const dy = p.y - f.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < p.size + f.size) {
        if (f.type === 'normal') {
          p.size += f.size * 0.2;
          p.xp += 2;
        } else if (f.type === 'turbo') {
          p.turbo = Date.now() + 5000;
          p.xp += 5;
        } else if (f.type === 'shield') {
          p.shield = Date.now() + 5000;
          p.xp += 5;
        }

        food.splice(i, 1);
        food.push({
          id: Math.random(),
          x: Math.random() * MAP_SIZE,
          y: Math.random() * MAP_SIZE,
          size: 10,
          type: Math.random() < 0.9 ? 'normal' : (Math.random() < 0.5 ? 'turbo' : 'shield')
        });

        // Missão simples
        if (Math.random() < 0.05) p.missionsCompleted++;
      }
    });

    for (let id in players) {
      if (id !== socket.id && players[id]) {
        const enemy = players[id];
        const dx = p.x - enemy.x;
        const dy = p.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (
          dist < p.size &&
          p.size > enemy.size * 1.1 &&
          (!enemy.shield || enemy.shield < Date.now())
        ) {
          p.size += enemy.size * 0.5;
          p.xp += 20;
          p.kills++;
          io.to(enemy.id).emit('dead');
          delete players[enemy.id];
        }
      }
    }

    // Level up
    const xpToNext = 50 + p.level * 20;
    if (p.xp >= xpToNext) {
      p.xp -= xpToNext;
      p.level++;
    }

    io.emit('food', food);
  });

  socket.on('chat message', (data) => {
    const cleanMessage = filterBadWords(data.message);
    const sender = players[socket.id]?.name || 'Anônimo';

    if (cleanMessage.startsWith('/')) {
      const [cmd] = cleanMessage.slice(1).split(' ');
      let response = '';

      switch (cmd.toLowerCase()) {
        case 'ping':
          response = `🏓 Pong!`;
          break;
        case 'help':
          response = `🛠 Comandos: /ping, /help`;
          break;
        default:
          response = `❓ Comando desconhecido: /${cmd}`;
      }

      socket.emit('chat message', {
        id: 'server',
        name: '[Servidor]',
        message: response
      });
    } else {
      io.emit('chat message', {
        id: socket.id,
        name: sender,
        message: cleanMessage
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔴 Player disconnected: ${socket.id}`);
    delete players[socket.id];
  });

  socket.emit('food', food);
});

setInterval(() => {
  const now = Date.now();

  

  for (let id in players) {
    const p = players[id];
    p.timeOnline = Math.floor((now - p.joinTime) / 1000);
  }

  const leaderboard = Object.values(players)
    .sort((a, b) => b.size - a.size)
    .slice(0, 5)
    .map(p => ({ name: p.name, size: p.size }));

  const clanSums = {};
  for (let id in players) {
    const p = players[id];
    if (p.clan) {
      if (!clanSums[p.clan]) clanSums[p.clan] = 0;
      clanSums[p.clan] += p.size;
    }
  }

  const clanRanking = Object.entries(clanSums)
    .map(([name, size]) => ({ name, size }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 5);

  const timeRanking = Object.values(players)
    .sort((a, b) => b.timeOnline - a.timeOnline)
    .slice(0, 5)
    .map(p => ({ name: p.name, time: p.timeOnline }));

  const killRanking = Object.values(players)
    .sort((a, b) => b.kills - a.kills)
    .slice(0, 5)
    .map(p => ({ name: p.name, kills: p.kills }));

  const missionRanking = Object.values(players)
    .sort((a, b) => b.missionsCompleted - a.missionsCompleted)
    .slice(0, 5)
    .map(p => ({ name: p.name, missions: p.missionsCompleted }));

  io.emit('state', {
    players,
    leaderboard,
    clanRanking,
    timeRanking,
    killRanking,
    missionRanking
  });
}, 1000 / 30);

server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
