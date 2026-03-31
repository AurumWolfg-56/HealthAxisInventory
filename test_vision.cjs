const http = require('http');

function makeRequest(imageBase64, label) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: 'qwen2.5-vl-7b-instruct',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageBase64 } },
          { type: 'text', text: 'What do you see? One word.' }
        ]
      }],
      max_tokens: 10
    });

    const req = http.request({
      hostname: '127.0.0.1',
      port: 1234,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(label + ': ' + res.statusCode + ' - ' + data.substring(0, 150));
        resolve(res.statusCode);
      });
    });

    req.on('error', (e) => {
      console.log(label + ': ERROR - ' + e.message);
      resolve(0);
    });
    
    req.write(body);
    req.end();
  });
}

async function runTests() {
  // Test 1: Tiny PNG (1x1) - this worked before
  const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  await makeRequest(tinyPng, 'Test1 (1x1 PNG)');

  // Test 2: Small PNG (10x10)
  const smallPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVQYV2P8z8BQz0BFwMgwqpCeYQEAZzYD/b8kLxIAAAAASUVORK5CYII=';
  await makeRequest(smallPng, 'Test2 (10x10 PNG)');

  // Test 3: Base64 WITHOUT data: prefix
  const rawBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  await makeRequest(rawBase64, 'Test3 (raw base64 no prefix)');

  // Test 4: JPEG data URI
  // Minimal 1x1 white JPEG
  const tinyJpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=';
  await makeRequest(tinyJpeg, 'Test4 (1x1 JPEG)');

  console.log('\nDone!');
}

runTests();
