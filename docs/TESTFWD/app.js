// Unified application for both HTTPS and HTTP sites
(function() {
  const isHttps = window.location.hostname === 'info.filament3d.org';
  
  // Parse URL parameters
  function parseParams(url) {
    const questionParams = {};
    const hashParams = {};
    
    const questionIndex = url.indexOf('?');
    const hashIndex = url.indexOf('#');
    
    if (questionIndex !== -1) {
      const end = hashIndex !== -1 ? hashIndex : url.length;
      const qString = url.substring(questionIndex + 1, end);
      qString.split('&').forEach(pair => {
        if (pair) {
          const [key, value] = pair.split('=');
          if (key) {
            if (!questionParams[key]) questionParams[key] = [];
            questionParams[key].push(decodeURIComponent(value || ''));
          }
        }
      });
    }
    
    if (hashIndex !== -1) {
      const hString = url.substring(hashIndex + 1);
      hString.split('&').forEach(pair => {
        if (pair) {
          const [key, value] = pair.split('=');
          if (key) {
            if (!hashParams[key]) hashParams[key] = [];
            hashParams[key].push(decodeURIComponent(value || ''));
          }
        }
      });
    }
    
    return { questionParams, hashParams };
  }
  
  // Display URL info
  function displayUrlInfo() {
    const url = window.location.href;
    const baseUrl = url.split('?')[0].split('#')[0];
    const { questionParams, hashParams } = parseParams(url);
    
    document.getElementById('baseUrl').textContent = baseUrl;
    
    let qHtml = '';
    for (let key in questionParams) {
      questionParams[key].forEach(val => {
        qHtml += `<div>${key} = ${val}</div>`;
      });
    }
    document.getElementById('questionParams').innerHTML = qHtml || '<div>None</div>';
    
    let hHtml = '';
    for (let key in hashParams) {
      hashParams[key].forEach(val => {
        hHtml += `<div>${key} = ${val}</div>`;
      });
    }
    document.getElementById('hashParams').innerHTML = hHtml || '<div>None</div>';
  }
  
  // IndexedDB operations
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ForwardDB', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }
  
  async function getDBValue(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ? request.result.value : '');
      request.onerror = () => reject(request.error);
    });
  }
  
  async function setDBValue(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  // HTTPS mode
  async function runHttpsMode() {
    document.getElementById('httpsMode').style.display = 'block';
    
    // Check for fwdsuccess param
    const { hashParams } = parseParams(window.location.href);
    if (hashParams.fwdidsuccess && hashParams.fwdidsuccess[0]) {
      await setDBValue('lastForwardSuccess', hashParams.fwdidsuccess[0]);
    }
    
    // Load and display DB values
    async function loadDBValues() {
      document.getElementById('forwardAddress').value = await getDBValue('forwardAddress');
      document.getElementById('forwardId').value = await getDBValue('forwardId');
      document.getElementById('lastForwardSuccess').value = await getDBValue('lastForwardSuccess');
    }
    
    await loadDBValues();
    
    // Save buttons
    document.getElementById('saveAddress').onclick = async () => {
      await setDBValue('forwardAddress', document.getElementById('forwardAddress').value);
      alert('Saved');
    };
    
    document.getElementById('saveId').onclick = async () => {
      await setDBValue('forwardId', document.getElementById('forwardId').value);
      alert('Saved');
    };
    
    document.getElementById('saveSuccess').onclick = async () => {
      await setDBValue('lastForwardSuccess', document.getElementById('lastForwardSuccess').value);
      alert('Saved');
    };
    
    // Forward button
    document.getElementById('forwardBtn').onclick = async () => {
      let forwardId = parseInt(await getDBValue('forwardId') || '0');
      forwardId++;
      await setDBValue('forwardId', forwardId.toString());
      
      const forwardAddress = await getDBValue('forwardAddress');
      if (!forwardAddress) {
        alert('Please set forward address first');
        return;
      }
      
      const url = window.location.href;
      const path = window.location.pathname;
      const { questionParams, hashParams } = parseParams(url);
      
      // Build new URL
      let newUrl = `http://${forwardAddress}${path}#`;
      
      // Add all question params first
      let params = [];
      for (let key in questionParams) {
        questionParams[key].forEach(val => {
          params.push(`${key}=${encodeURIComponent(val)}`);
        });
      }
      
      // Then add all hash params
      for (let key in hashParams) {
        hashParams[key].forEach(val => {
          params.push(`${key}=${encodeURIComponent(val)}`);
        });
      }
      
      // Add fwdid
      params.push(`fwdid=${forwardId}`);
      
      newUrl += params.join('&');
      window.location.href = newUrl;
    };
  }
  
  // HTTP mode
  function runHttpMode() {
    document.getElementById('httpMode').style.display = 'block';
    
    // Extract fwdid and create iframe
    const { hashParams } = parseParams(window.location.href);
    if (hashParams.fwdid && hashParams.fwdid[0]) {
      const fwdid = hashParams.fwdid[0];
      const path = window.location.pathname;
      const iframeUrl = `https://info.filament3d.org${path}#fwdidsuccess=${fwdid}`;
      
      const iframe = document.createElement('iframe');
      iframe.src = iframeUrl;
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      
      document.getElementById('iframeInfo').textContent = `Created hidden iframe to: ${iframeUrl}`;
    }
  }
  
  // Initialize
  window.addEventListener('DOMContentLoaded', () => {
    displayUrlInfo();
    
    if (isHttps) {
      runHttpsMode();
    } else {
      runHttpMode();
    }
  });
})();
