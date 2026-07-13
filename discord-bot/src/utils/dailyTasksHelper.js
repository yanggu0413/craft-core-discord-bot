const SLAY_POOL = [
  { type: 1, target: 'Zombie', count: 15, reward: 250 },
  { type: 1, target: 'Skeleton', count: 10, reward: 300 },
  { type: 1, target: 'Creeper', count: 5, reward: 400 }
];

const MINE_POOL = [
  { type: 2, target: 'Coal Ore', count: 20, reward: 200 },
  { type: 2, target: 'Iron Ore', count: 10, reward: 300 },
  { type: 2, target: 'Diamond Ore', count: 3, reward: 1000 }
];

function getHashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (31 * hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

class SeededRandom {
  constructor(seed) {
    this.seed = Number(BigInt(seed) & 0xffffffffn);
  }
  nextInt(bound) {
    const nextSeed = (BigInt(this.seed) * 1103515245n + 12345n) & 0x7fffffffn;
    this.seed = Number(nextSeed);
    return this.seed % bound;
  }
}

function getDailyTasksFallback(dateStr) {
  const hash = getHashCode(dateStr);
  const rand = new SeededRandom(hash);
  const slayIdx = rand.nextInt(SLAY_POOL.length);
  const mineIdx = rand.nextInt(MINE_POOL.length);
  return [
    { ...SLAY_POOL[slayIdx] },
    { ...MINE_POOL[mineIdx] }
  ];
}

function getTaipeiDateString() {
  const options = { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const formatted = formatter.format(new Date());
  return formatted.replace(/\//g, '-');
}

module.exports = {
  getDailyTasksFallback,
  getTaipeiDateString,
  SLAY_POOL,
  MINE_POOL
};
