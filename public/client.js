const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let player = { x: 0, y: 0, size: 10, name: '', clan: '', xp: 0, level: 1, kills: 0 };
let players = {};
let food = [];
let leaderboard = [];
let clanRanking = [];
let timeRanking = [];
let killRanking = [];
let missionRanking = [];

const nameInput = document.getElementById('nameInput');
const clanInput = document.getElementById('clanInput');
const skinInput = document.getElementById('skinInput');


nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    player.name = nameInput.value.trim() || `Player_${Math.floor(Math.random() * 1000)}`;
    player.clan = clanInput.value.trim();
    socket.emit('init', player.name, player.clan);
    nameInput.style.display = 'none';
    clanInput.style.display = 'none';
    skinInput.style.display = 'none';
  }
});

const chatInput = document.getElementById('chatInput');
const messages = document.getElementById('messages');

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && chatInput.value.trim()) {
    socket.emit('chat message', { message: chatInput.value });
    chatInput.value = '';
  }
});

socket.on('chat message', (data) => {
  const msg = document.createElement('div');
  msg.textContent = `${data.name}: ${data.message}`;
  msg.style.color = data.id === socket.id ? 'blue' : (data.id === 'server' ? 'green' : 'black');
  msg.className = data.id === 'server' ? 'server-msg' : 'player-msg';
  document.getElementById('messages').appendChild(msg);
  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;
  setTimeout(() => msg.remove(), 8000);
});

socket.on('dead', () => {
  alert('Você foi devorado!');
  location.reload();
});

socket.on('food', (data) => {
  food = data;
});

socket.on('state', (data) => {
  players = data.players;
  leaderboard = data.leaderboard;
  clanRanking = data.clanRanking;
  timeRanking = data.timeRanking;
  killRanking = data.killRanking;
  missionRanking = data.missionRanking;

  const me = data.players[socket.id];
  if (me) {
    document.getElementById('timeOnline').textContent = `${me.timeOnline}s`;
  }
  
  io.emit('state', {
    players,
    leaderboard,
    clanRanking,
    timeRanking,
    killRanking,
    missionRanking
  });

});

let zoom = 1;
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoom += e.deltaY * -0.001;
  zoom = Math.min(Math.max(0.2, zoom), 2);
}, { passive: false });

function drawMinimap(me) {
  const miniSize = 200;
  const scale = miniSize / 3000 / zoom;
  const offset = 10;

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(canvas.width - miniSize - offset, offset, miniSize, miniSize);

  // comida
  food.forEach(f => {
    ctx.fillStyle = f.type === 'normal' ? 'green' : (f.type === 'turbo' ? 'red' : 'blue');
    ctx.fillRect(canvas.width - miniSize - offset + f.x * scale, offset + f.y * scale, 2, 2);
  });

  // jogadores
  for (let id in players) {
    const p = players[id];
    ctx.fillStyle = id === socket.id ? 'black' : (p.clan === me.clan && p.clan ? 'gold' : 'gray');
    ctx.fillRect(canvas.width - miniSize - offset + p.x * scale, offset + p.y * scale, 4, 4);
  }

  // visão da câmera
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 1;
  ctx.strokeRect(
    canvas.width - miniSize - offset + me.x * scale - canvas.width * scale / 2,
    offset + me.y * scale - canvas.height * scale / 2,
    canvas.width * scale,
    canvas.height * scale
  );
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const me = players[socket.id];
  if (!me) return requestAnimationFrame(draw);

  const camera = {
    x: me.x - canvas.width / 2 / zoom,
    y: me.y - canvas.height / 2 / zoom,
  };

  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-camera.x, -camera.y);

  // Limites do mapa
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 10;
  ctx.strokeRect(0, 0, 3000, 3000);

  // comida
  food.forEach(f => {
    ctx.fillStyle = f.type === 'normal' ? 'green' : (f.type === 'turbo' ? 'red' : 'blue');
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // jogadores
  for (let id in players) {
    const p = players[id];
    if (!p) continue;

    ctx.beginPath();
    ctx.fillStyle = p.color;
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();

    if (p.clan && me.clan && p.clan === me.clan && id !== socket.id) {
      ctx.strokeStyle = 'gold';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.fillStyle = 'black';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, p.x, p.y - p.size - 10);

    if (p.clan) {
      ctx.fillStyle = 'gray';
      ctx.font = '12px monospace';
      ctx.fillText(`[${p.clan}]`, p.x, p.y - p.size - 25);
    }

    // XP/Nível
    ctx.fillStyle = 'purple';
    ctx.fillText(`Lv. ${p.level}`, p.x, p.y + p.size + 14);
  }

  ctx.restore();

  // minimapa
  drawMinimap(me);

  // Rankings
  ctx.fillStyle = 'black';
  ctx.font = '14px monospace';
  ctx.textAlign = 'left';

  ctx.fillText('🏆 Top Jogadores:', 10, 20);
  leaderboard.forEach((p, i) => {
    ctx.fillText(`${i + 1}. ${p.name} (${Math.floor(p.size)})`, 10, 40 + i * 20);
  });

  ctx.fillText('👑 Top Clãs:', 10, 180);
  clanRanking.forEach((clan, i) => {
    ctx.fillText(`${i + 1}. ${clan.name} (${Math.floor(clan.size)})`, 10, 200 + i * 20);
  });

  ctx.fillText('🕓 Top Tempo Online:', 10, 300);
  timeRanking.forEach((p, i) => {
    ctx.fillText(`${i + 1}. ${p.name} (${Math.floor(p.time / 1000)}s)`, 10, 320 + i * 20);
  });

  ctx.fillText('⚔️ Top Kills:', 10, 420);
  killRanking.forEach((p, i) => {
    ctx.fillText(`${i + 1}. ${p.name} (${p.kills})`, 10, 440 + i * 20);
  });

  ctx.fillText('🎯 Top Missões:', 10, 520);
  missionRanking.forEach((p, i) => {
    ctx.fillText(`${i + 1}. ${p.name} (${p.missions})`, 10, 540 + i * 20);
  });

  requestAnimationFrame(draw);
}

draw();

setInterval(() => {
  if (players[socket.id]) {
    const me = players[socket.id];
    const dx = mouse.x - canvas.width / 2;
    const dy = mouse.y - canvas.height / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = me.turbo > Date.now() ? 8 : 3;

    const nextX = me.x + (dx / dist) * speed || 0;
    const nextY = me.y + (dy / dist) * speed || 0;

    // Limitar ao mapa
    me.x = Math.min(3000, Math.max(0, nextX));
    me.y = Math.min(3000, Math.max(0, nextY));

    socket.emit('update', { x: me.x, y: me.y });
  }
}, 1000 / 60);

let mouse = { x: 0, y: 0 };
canvas.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});
