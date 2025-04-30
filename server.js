const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 4000;
const path = require('path');
const fs = require('fs');

// Enable CORS for all origins
app.use(cors());

// In-memory cache store
const cache = {};



// Update the vulnerableCacheMiddleware
const vulnerableCacheMiddleware = (req, res, next) => {
    const cacheKey = `${req.path}:${req.query.fromToken}-${req.query.toToken}`;
    
    if (cache[cacheKey]) {
      console.log(`Cache HIT: ${cacheKey}`);
      if (cache[cacheKey].status && cache[cacheKey].body) {
        // Send as proper JSON
        return res
          .status(cache[cacheKey].status)
          .set('Content-Type', 'application/json')
          .json(cache[cacheKey].body);
      }
      delete cache[cacheKey];
    }
  
    const originalJson = res.json.bind(res);
    
    res.json = body => {
      // Only cache successful responses
     // if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          cache[cacheKey] = {
            status: res.statusCode,
            body: JSON.parse(JSON.stringify(body)) // Safe clone
          };
          console.log(`Cached response for ${cacheKey} (status: ${res.statusCode})`);

        } catch (e) {
          console.error('Caching failed:', e);
        }
    //  }
      
      // Send original response
      originalJson(body);
    };
  
    console.log(`Cache MISS: ${cacheKey}`);
    next();
  };

const tokenPrices = {
  'ETH': 3500,
  'BTC': 60000,
  'USDT': 1,
  'USDC': 1,
  'LINK': 15,
  'UNI': 12
};

// Add this endpoint before the swap-estimate endpoint
app.get('/api/tokens', (req, res) => {
  const tokenList = {
    ETH: {
      name: "Ethereum",
      decimals: 18,
      address: "0x0000000000000000000000000000000000000000" // Mock ETH address
    },
    USDC: {
      name: "USD Coin",
      decimals: 6,
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    },
    USDT: {
      name: "Tether USD",
      decimals: 6,
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7"
    },
    BTC: {
      name: "Wrapped Bitcoin",
      decimals: 8,
      address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"
    },
    LINK: {
      name: "Chainlink",
      decimals: 18,
      address: "0x514910771AF9Ca656af840dff83E8264EcF986CA"
    },
    UNI: {
      name: "Uniswap",
      decimals: 18,
      address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984"
    }
  };

  res.json(tokenList);
});

// Modified Swap estimation endpoint with HHO vulnerability
app.get('/api/swap-estimate', vulnerableCacheMiddleware, (req, res) => {
  const { fromToken, toToken, amount } = req.query;

  // ===== SINGLE HHO Attack Detection =====
  let headerSize = 0;
  for (const [key, value] of Object.entries(req.headers)) {
    // Calculate byte length properly for Unicode characters
    const keyLength = Buffer.byteLength(key);
    const valueLength = Array.isArray(value) 
      ? value.reduce((acc, v) => acc + Buffer.byteLength(v), 0)
      : Buffer.byteLength(value);
      
    headerSize += keyLength + valueLength + 2; // +2 for ": "
  }

  const MAX_HEADER_SIZE = 16000;
  console.log(`HHO Check: ${headerSize}/${MAX_HEADER_SIZE} bytes`);

  if (headerSize > MAX_HEADER_SIZE) {
    console.log(`💥 HHO ATTACK SUCCESS (${headerSize} > ${MAX_HEADER_SIZE})`);
    return res.status(400).json({
      error: 'HHO Cache Poisoning Success',
      headerSize,
      maxAllowed: MAX_HEADER_SIZE,
      cached: true,
      timestamp: new Date().toISOString()
    });
  }
  // ===== End HHO Detection =====

  // Check for poison parameter first for easy testing
  if (req.query.poison === 'true') {
    console.log('Poisoning attack triggered via query parameter');
    res.status(400).json({ 
      error: 'Bad Request', 
      message: 'This response is poisoned and will be cached',
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (!fromToken || !toToken || !amount || 
      !tokenPrices[fromToken] || !tokenPrices[toToken]) {
    console.log("Invalid swap parameters");
    return res.status(400).json({ error: 'Invalid swap parameters' });
  }
  
  const fromPrice = tokenPrices[fromToken];
  const toPrice = tokenPrices[toToken];
  const exchangeRate = fromPrice / toPrice;
  
  const estimatedAmount = parseFloat(amount) * exchangeRate;
  
  res.json({
    fromToken,
    toToken,
    inputAmount: parseFloat(amount),
    outputAmount: estimatedAmount.toFixed(6),
    exchangeRate: exchangeRate.toFixed(6),
    timestamp: new Date().toISOString()
  });
  console.log(`Cached response for ${cacheKey} (status: ${res.statusCode})`);
  console.log("Response is", res);
});

// Cache management - endpoint to clear cache (for testing)
app.get('/admin/clear-cache', (req, res) => {
  const beforeCount = Object.keys(cache).length;
  Object.keys(cache).forEach(key => delete cache[key]);
  console.log(`Cache cleared - Removed ${beforeCount} entries`);
  
  // Send response with no-cache directives to ensure browsers don't use old data
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  
  res.json({ 
    message: 'Cache cleared successfully', 
    cacheSize: 0,
    timestamp: new Date().toISOString()
  });
});

// Diagnostic endpoint to view cache contents
app.get('/admin/view-cache', (req, res) => {
  const cacheKeys = Object.keys(cache);
  res.json({
    cacheSize: cacheKeys.length,
    keys: cacheKeys,
    timestamp: new Date().toISOString()
  });
});

// Replace the debug middleware with this safer version
app.use((req, res, next) => {
  console.log(`Request: ${req.method} ${req.originalUrl}`);
  
  // Ultra-safe header logging
  const headerSummary = {};
  for (const [key, value] of Object.entries(req.headers)) {
    headerSummary[key] = typeof value === 'string' 
      ? `[string ${value.length} chars]`
      : Array.isArray(value)
        ? `[array ${value.length} items]`
        : typeof value;
  }
  
  console.log('Header summary:', JSON.stringify(headerSummary));
  next();
});

// Serve static files from public directory
app.use(express.static('public'));

// VULNERABILITY: Cache poisoning to make a static image disappear , NOT FULLY IMLEMENTED
app.get('/api/logo', vulnerableCacheMiddleware, (req, res) => {
  // VULNERABILITY: This header affects whether the image is returned but isn't in the cache key
  const imageVariant = req.headers['x-image-variant'] || 'default';
  
  if (imageVariant === 'none') {
    // Return a 404 for the image when the "none" variant is requested
    console.log('Image disappearing attack triggered');
    res.status(404).send({ error: 'Image not found' });
    return;
  }
  
  // Default behavior: return a placeholder image or redirect to a real image
  const logoUrl = 'https://blockchain-lab-assets.s3.amazonaws.com/web3-logo.png';
  res.redirect(302, logoUrl);
});

// Add a testing endpoint that embeds the image
app.get('/test-image', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Image Cache Poisoning Test</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; margin: 50px; }
        .logo { max-width: 300px; margin: 20px auto; }
        .error { color: red; }
        button { padding: 10px; margin: 10px; }
      </style>
    </head>
    <body>
      <h1>Image Cache Poisoning Test</h1>
      <p>The image below is vulnerable to cache poisoning.</p>
      
      <div class="logo">
        <img src="/api/logo" alt="Web3 Logo" id="logo" onerror="document.getElementById('error-msg').style.display='block'">
      </div>
      
      <div id="error-msg" class="error" style="display:none">
        ⚠️ Image failed to load - this could be due to cache poisoning!
      </div>
      
      <div>
        <button onclick="poisonImage()">Poison Image Cache</button>
        <button onclick="clearCache()">Clear Cache</button>
        <button onclick="location.reload()">Reload Page</button>
      </div>
      
      <script>
        function poisonImage() {
          fetch('/api/logo', { 
            headers: { 'X-Image-Variant': 'none' } 
          })
          .then(() => alert('Cache poisoning attempt complete. Reload the page to see the effect.'))
          .catch(err => console.error('Error:', err));
        }
        
        function clearCache() {
          fetch('/admin/clear-cache')
            .then(response => response.json())
            .then(data => {
              alert('Cache cleared: ' + data.message);
              location.reload();
            })
            .catch(err => console.error('Error:', err));
        }
      </script>
    </body>
    </html>
  `);
});

// Start the server
app.listen(PORT, () => {
  console.log(`HHO Attack Server running on port ${PORT}\n`);
  console.log('Test Commands:');
  console.log('1. Normal request:');
  console.log('curl "http://localhost:4000/api/swap-estimate?fromToken=ETH&toToken=USDT&amount=1"');
  
  console.log('\n2. Poison cache with HHO attack:');
  console.log('curl "http://localhost:4000/api/swap-estimate?fromToken=ETH&toToken=USDT&amount=1" \\');
  console.log('  -H "X-Oversize-Header-1: $(dd if=/dev/zero bs=8000 count=1 2>/dev/null | tr \'\\0\' \'0\')" \\');
  console.log('  -H "X-Oversize-Header-2: $(dd if=/dev/zero bs=8000 count=1 2>/dev/null | tr \'\\0\' \'0\')"');
  
  console.log('\n3. Verify cached error:');
  console.log('curl "http://localhost:4000/api/swap-estimate?fromToken=ETH&toToken=USDT&amount=1"');
  
  console.log('\n4. Clear cache:');
  console.log('curl http://localhost:4000/admin/clear-cache');
});

const safeStringify = (obj) => {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    return value;
  }, 2);
}; 
