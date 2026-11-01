// Game logic kept independent from Three.js so it can be tested and extended.
export const SAVE_KEY = 'my-little-world-v0.1';
export const PLOT_COUNT = 12;
export const EGG_COUNT = 3;
export const CROP_GROW_MS = 45_000;
export const EGG_REPLENISH_MS = 35_000;
export const MAX_DECORATIONS = 8;

const number = (v, min, max, fallback) => Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
const integer = (v, min, max, fallback) => Math.trunc(number(v, min, max, fallback));

export function createState(now = Date.now()) {
  return {
    version: 1,
    coins: 120,
    xp: 0,
    inventory: { seeds: 6, carrots: 0, eggs: 0, apples: 0 },
    plots: Array.from({length: PLOT_COUNT}, () => ({ plantedAt: 0, watered: false })),
    nests: Array.from({length: EGG_COUNT}, () => ({ readyAt: now })),
    appleReadyAt: now,
    houseColor: 'peach',
    decorations: [],
    quests: { harvest: 0, eggs: 0, decorate: 0, claimed: {} },
    lastGiftAt: now,
    giftPending: false,
    player: { x: 0, z: 8 },
  };
}

export function safeState(raw, now = Date.now()) {
  const s = createState(now);
  if (!raw || typeof raw !== 'object' || raw.version !== 1) return s;
  s.coins = integer(raw.coins, 0, 999999, s.coins);
  s.xp = integer(raw.xp, 0, 9999999, 0);
  for (const key of Object.keys(s.inventory)) s.inventory[key] = integer(raw.inventory?.[key], 0, 99999, s.inventory[key]);
  if (Array.isArray(raw.plots)) s.plots = s.plots.map((p, i) => ({
    plantedAt: integer(raw.plots[i]?.plantedAt, 0, now + 10_000, 0),
    watered: raw.plots[i]?.watered === true,
  }));
  if (Array.isArray(raw.nests)) s.nests = s.nests.map((n, i) => ({ readyAt: integer(raw.nests[i]?.readyAt, 0, now + 365*86400000, now) }));
  s.appleReadyAt = integer(raw.appleReadyAt, 0, now + 365*86400000, now);
  s.houseColor = ['peach', 'mint', 'lavender', 'cream'].includes(raw.houseColor) ? raw.houseColor : 'peach';
  if (Array.isArray(raw.decorations)) {
    const valid = ['flower', 'bench', 'lamp'];
    s.decorations = [...new Set(raw.decorations.filter(x => x && Number.isInteger(x.slot) && x.slot >= 0 && x.slot < MAX_DECORATIONS && valid.includes(x.kind)).map(x => x.slot))]
      .map(slot => ({slot, kind: raw.decorations.find(x => x.slot === slot && valid.includes(x.kind)).kind}));
  }
  for (const key of ['harvest', 'eggs', 'decorate']) s.quests[key] = integer(raw.quests?.[key], 0, 9999, 0);
  s.quests.claimed = {};
  for (const key of ['harvest', 'eggs', 'decorate']) s.quests.claimed[key] = raw.quests?.claimed?.[key] === true;
  s.lastGiftAt = integer(raw.lastGiftAt, 0, now + 100000, now);
  s.giftPending = raw.giftPending === true;
  s.player = { x: number(raw.player?.x, -33, 33, 0), z: number(raw.player?.z, -33, 33, 8) };
  return s;
}

export function cropPhase(plot, now = Date.now()) {
  if (!plot.plantedAt) return 'empty';
  const duration = CROP_GROW_MS - (plot.watered ? 15_000 : 0);
  return now - plot.plantedAt >= duration ? 'ready' : 'growing';
}
export function cropProgress(plot, now = Date.now()) {
  if (!plot.plantedAt) return 0;
  return Math.min(100, Math.max(0, Math.round((now - plot.plantedAt) / (CROP_GROW_MS - (plot.watered ? 15_000 : 0)) * 100)));
}
export function interactPlot(state, index, now = Date.now()) {
  const plot = state.plots[index];
  if (!plot) return { ok: false, message: 'Không tìm thấy luống đất.' };
  const phase = cropPhase(plot, now);
  if (phase === 'empty') {
    if (!state.inventory.seeds) return { ok: false, message: 'Hết hạt giống! Hãy đến cửa hàng.' };
    state.inventory.seeds--;
    plot.plantedAt = now;
    plot.watered = false;
    return { ok: true, message: 'Đã gieo cà rốt! Quay lại thu hoạch sau nhé.', action: 'plant' };
  }
  if (phase === 'growing') {
    if (plot.watered) return {ok: false, message: `Cây đang lớn (${cropProgress(plot, now)}%). Hãy chờ một chút.`};
    plot.watered = true;
    return {ok: true, message: 'Đã tưới nước! Cà rốt sẽ lớn nhanh hơn.', action: 'water'};
  }
  state.inventory.carrots += 3;
  state.xp += 15;
  state.quests.harvest++;
  plot.plantedAt = 0; plot.watered = false;
  return {ok: true, message: '+3 cà rốt, +15 XP! Có thể gieo tiếp.', action: 'harvest'};
}
export function collectEgg(state, index, now = Date.now()) {
  const nest = state.nests[index];
  if (!nest) return {ok: false, message: 'Không tìm thấy ổ trứng.'};
  if (now < nest.readyAt) return {ok: false, message: `Gà chưa đẻ trứng. Còn ${Math.ceil((nest.readyAt - now)/1000)} giây.`};
  nest.readyAt = now + EGG_REPLENISH_MS;
  state.inventory.eggs++;
  state.xp += 8;
  state.quests.eggs++;
  return {ok: true, message: '+1 trứng, +8 XP!'};
}
export function collectApple(state, now = Date.now()) {
  if (now < state.appleReadyAt) return {ok: false, message:'Cây táo chưa ra quả mới.'};
  state.appleReadyAt = now + 40_000;
  state.inventory.apples += 2;
  state.xp += 6;
  return {ok: true, message: '+2 táo, +6 XP!'};
}
export function sellGoods(state) {
  const value = state.inventory.carrots * 8 + state.inventory.eggs * 12 + state.inventory.apples * 10;
  if (!value) return {ok:false, message:'Chưa có nông sản để bán.'};
  state.inventory.carrots = 0; state.inventory.eggs = 0; state.inventory.apples = 0;
  state.coins += value;
  return {ok:true, message:`Đã bán nông sản, nhận ${value} Coins!`};
}
export function buySeeds(state) {
  if (state.coins < 30) return {ok:false, message:'Bạn cần 30 Coins để mua 5 hạt giống.'};
  state.coins -= 30; state.inventory.seeds += 5;
  return {ok:true, message:'Đã mua 5 hạt giống!'};
}
export const DECOR = {
  flower: {price: 25, title: 'Chậu hoa', icon:'🌼'},
  bench: {price: 65, title: 'Ghế gỗ', icon:'🪑'},
  lamp: {price: 45, title: 'Đèn vườn', icon:'💡'},
};
export function addDecoration(state, kind) {
  const entry = DECOR[kind];
  if (!entry) return {ok:false, message:'Vật phẩm không hợp lệ.'};
  const occupied = new Set(state.decorations.map(x => x.slot));
  const slot = Array.from({length:MAX_DECORATIONS}, (_,i)=>i).find(i=>!occupied.has(i));
  if (slot === undefined) return {ok:false, message:'Sân đã đầy (8/8). Hãy dọn bớt đồ.'};
  if (state.coins < entry.price) return {ok:false, message:`Không đủ Coins. Cần ${entry.price}.`};
  state.coins -= entry.price;
  state.decorations.push({slot, kind});
  state.quests.decorate++;
  state.xp += 5;
  return {ok:true, message:`Đã đặt ${entry.title.toLowerCase()} ở sân nhà, +5 XP!`};
}
export function removeLastDecoration(state) {
  const item = state.decorations.pop();
  if (!item) return {ok:false, message:'Chưa có đồ trang trí để dọn.'};
  const refund = Math.floor(DECOR[item.kind].price * .5);
  state.coins += refund;
  return {ok:true, message:`Đã cất đồ, hoàn ${refund} Coins.`};
}
export const QUESTS = [
  {id:'harvest', title:'Thu hoạch 3 lần', goal:3, reward:90, icon:'🥕'},
  {id:'eggs', title:'Nhặt 3 quả trứng', goal:3, reward:70, icon:'🥚'},
  {id:'decorate', title:'Trang trí 2 món', goal:2, reward:75, icon:'🏡'},
];
export function claimQuest(state, id) {
  const q = QUESTS.find(x=>x.id===id);
  if (!q) return {ok:false, message:'Không tìm thấy nhiệm vụ.'};
  if (state.quests.claimed[id]) return {ok:false, message:'Đã nhận phần thưởng.'};
  if (state.quests[id] < q.goal) return {ok:false, message:'Nhiệm vụ chưa hoàn thành.'};
  state.quests.claimed[id] = true;
  state.coins += q.reward;
  state.xp += 20;
  return {ok:true, message:`Nhận ${q.reward} Coins và 20 XP!`};
}
export function levelForXP(xp) { return Math.floor(Math.max(0, xp) / 100) + 1; }
export function nextLevelPercent(xp) { return Math.round(Math.max(0, xp % 100)); }
