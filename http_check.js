// Manual visual inspection test
const https = require('https');
const fs = require('fs');

// Create a simple HTTP request to check the page
const options = {
  hostname: '185.217.126.72',
  port: 80,
  path: '/threejs-blob-engine/',
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  }
};

console.log('Testing direct access to the application...');

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers, null, 2)}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response received, length:', data.length);
    
    // Check if we got redirected to HTTP instead of HTTPS
    if (res.statusCode >= 300 && res.statusCode < 400) {
      console.log('Redirect detected:', res.headers.location);
    }
    
    // Save response for analysis
    fs.writeFileSync('/root/.openclaw/workspace/raw_response.html', data);
    
    // Try with regular http instead of https
    console.log('Trying with HTTP instead of HTTPS...');
    const http = require('http');
    const httpOptions = {
      hostname: '185.217.126.72',
      port: 80,
      path: '/threejs-blob-engine/',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    };

    const httpReq = http.request(httpOptions, (httpRes) => {
      console.log(`HTTP Status: ${httpRes.statusCode}`);
      
      let httpData = '';
      httpRes.on('data', (chunk) => {
        httpData += chunk;
      });
      
      httpRes.on('end', () => {
        console.log('HTTP Response received, length:', httpData.length);
        fs.writeFileSync('/root/.openclaw/workspace/raw_http_response.html', httpData);
        
        // Check for common patterns in the response
        const hasCanvas = httpData.toLowerCase().includes('<canvas');
        const hasThreeJS = httpData.toLowerCase().includes('three') || httpData.toLowerCase().includes('three.js');
        const hasBlob = httpData.toLowerCase().includes('blob');
        
        console.log('Contains <canvas>:', hasCanvas);
        console.log('Contains Three.js references:', hasThreeJS);
        console.log('Contains blob references:', hasBlob);
        
        // Look for specific elements that should be present
        const canvasMatches = httpData.match(/<canvas[^>]*>/gi);
        console.log('Canvas elements found:', canvasMatches ? canvasMatches.length : 0);
        
        if (canvasMatches) {
          console.log('Canvas tags:', canvasMatches);
        }
      });
    });

    httpReq.on('error', (e) => {
      console.error('HTTP request error:', e.message);
    });

    httpReq.end();
  });
});

req.on('error', (e) => {
  console.error('HTTPS request error:', e.message);
  console.log('Trying HTTP instead...');
  
  // Fallback to HTTP
  const http = require('http');
  const httpOptions = {
    hostname: '185.217.126.72',
    port: 80,
    path: '/threejs-blob-engine/',
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  };

  const httpReq = http.request(httpOptions, (httpRes) => {
    console.log(`HTTP Status: ${httpRes.statusCode}`);
    
    let httpData = '';
    httpRes.on('data', (chunk) => {
      httpData += chunk;
    });
    
    httpRes.on('end', () => {
      console.log('HTTP Response received, length:', httpData.length);
      fs.writeFileSync('/root/.openclaw/workspace/raw_http_response.html', httpData);
      
      // Check for common patterns in the response
      const hasCanvas = httpData.toLowerCase().includes('<canvas');
      const hasThreeJS = httpData.toLowerCase().includes('three') || httpData.toLowerCase().includes('three.js');
      const hasBlob = httpData.toLowerCase().includes('blob');
      
      console.log('Contains <canvas>:', hasCanvas);
      console.log('Contains Three.js references:', hasThreeJS);
      console.log('Contains blob references:', hasBlob);
    });
  });

  httpReq.on('error', (e) => {
    console.error('HTTP request also failed:', e.message);
  });

  httpReq.end();
});

req.end();