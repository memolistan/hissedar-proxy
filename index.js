const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const COLLECT_KEY = 'apikey 3ZKKilSTBl5pBeBjyFRjVK:6K9ItOXZkhI0NqIRwhoXDV';

let cachedData = null;
let cacheTime = 0;
const CACHE_TTL = 60000;

function fetchAllStocks() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.collectapi.com',
      path: '/economy/hisseSenedi?gunluk=1&hisse=THYAO',
      method: 'GET',
      headers: {
        'authorization': COLLECT_KEY,
        'content-type': 'application/json',
      },
    };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString()));
        } catch (e) {
          reject(new Error('Parse error: ' + e.message));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function getCachedData() {
  const now = Date.now();
  if (cachedData && (now - cacheTime) < CACHE_TTL) return cachedData;
  const data = await fetchAllStocks();
  cachedData = data;
  cacheTime = now;
  return data;
}

app.get('/all', async (req, res) => {
  try {
    const data = await getCachedData();
    if (!data.success) return res.status(500).json({ error: 'Veri alınamadı' });
    res.json(data.result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/price/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const data = await getCachedData();
    if (!data.success) return res.status(404).json({ error: 'Veri alınamadı' });
    const stock = data.result.find(s => s.code === symbol);
    if (!stock) return res.status(404).json({ error: `${symbol} bulunamadı` });
    res.json({
      symbol,
      price: stock.lastprice,
      change: stock.rate,
      changePercent: stock.rate,
      high: stock.max,
      low: stock.min,
      volume: stock.hacim,
      name: stock.text,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/prices', async (req, res) => {
  try {
    const symbols = req.query.symbols.split(',').map(s => s.toUpperCase());
    const data = await getCachedData();
    if (!data.success) return res.status(500).json({ error: 'Veri alınamadı' });
    const results = {};
    for (const symbol of symbols) {
      const stock = data.result.find(s => s.code === symbol);
      if (stock) {
        results[symbol] = {
          price: stock.lastprice,
          change: stock.rate,
          changePercent: stock.rate,
          high: stock.max,
          low: stock.min,
          volume: stock.hacim,
          name: stock.text,
        };
      }
    }
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
const http = require('http');

app.get('/news', async (req, res) => {
  try {
    const feeds = [
      'https://www.bloomberght.com/rss',
      'https://www.ekonomim.com/rss',
      'https://www.haberturk.com/rss/ekonomi.xml',
    ];

    const fetchFeed = (url) => new Promise((resolve) => {
      const lib = url.startsWith('https') ? https : http;
      lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks).toString()));
      }).on('error', () => resolve(''));
    });

    const results = await Promise.all(feeds.map(fetchFeed));
    const allNews = [];

    results.forEach(xml => {
      if (!xml) return;
      const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
      items.slice(0, 10).forEach(item => {
        const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/))?.[1] || '';
        const linkRaw = (item.match(/<link>(.*?)<\/link>/) || item.match(/<link><!\[CDATA\[(.*?)\]\]><\/link>/) || [])[1] || '';
const link = linkRaw.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
        const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
        if (title && link) {
          allNews.push({
            title: title.trim(),
            url: link.trim(),
            source: (() => { try { return new URL(link).hostname.replace('www.', ''); } catch(e) { return 'Haber'; } })(),
            datetime: pubDate ? new Date(pubDate).getTime() / 1000 : Date.now() / 1000,
          });
        }
      });
    });

    allNews.sort((a, b) => b.datetime - a.datetime);
    res.json(allNews.slice(0, 30));
  } catch (e) {
    console.log('News error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Proxy ${PORT} portunda çalışıyor`);
});