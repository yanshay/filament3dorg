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
    
    // Check for fwdidsuccess param and return flag
    const { hashParams, questionParams } = parseParams(window.location.href);
    
    const fwdidsuccess = (hashParams.fwdidsuccess && hashParams.fwdidsuccess[0]) || 
                         (questionParams.fwdidsuccess && questionParams.fwdidsuccess[0]);
    
    const returnFlag = (hashParams.return && hashParams.return[0]) || 
                       (questionParams.return && questionParams.return[0]);
    
    // Step 3: If we received fwdidsuccess, save it and check for return flag
    if (fwdidsuccess) {
      console.log('Found fwdidsuccess:', fwdidsuccess);
      try {
        await setDBValue('lastForwardSuccess', fwdidsuccess);
        console.log('Saved lastForwardSuccess:', fwdidsuccess);
        
        // If return=true, redirect back to HTTP
        if (returnFlag === 'true') {
          console.log('Return flag detected, redirecting back to HTTP');
          
          const forwardAddress = await getDBValue('forwardAddress');
          if (forwardAddress) {
            const path = window.location.pathname;
            
            // Get all params except fwdidsuccess and return
            let params = [];
            for (let key in hashParams) {
              if (key !== 'fwdidsuccess' && key !== 'return') {
                hashParams[key].forEach(val => {
                  params.push(`${key}=${encodeURIComponent(val)}`);
                });
              }
            }
            for (let key in questionParams) {
              if (key !== 'fwdidsuccess' && key !== 'return') {
                questionParams[key].forEach(val => {
                  params.push(`${key}=${encodeURIComponent(val)}`);
                });
              }
            }
            
            let returnUrl = `http://${forwardAddress}${path}`;
            if (params.length > 0) {
              returnUrl += '#' + params.join('&');
            }
            
            console.log('Redirecting to:', returnUrl);
            window.location.href = returnUrl;
            return; // Don't continue loading the page
          }
        }
      } catch (err) {
        console.error('Error saving lastForwardSuccess:', err);
      }
    }
    
    // Load and display DB values
    async function loadDBValues() {
      try {
        document.getElementById('forwardAddress').value = await getDBValue('forwardAddress');
        document.getElementById('forwardId').value = await getDBValue('forwardId');
        document.getElementById('lastForwardSuccess').value = await getDBValue('lastForwardSuccess');
      } catch (err) {
        console.error('Error loading DB values:', err);
      }
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
    
    // Forward button - Step 1: Forward to HTTP
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
      console.log('Forwarding to HTTP:', newUrl);
      window.location.href = newUrl;
    };
  }
  
  // HTTP mode - Step 2: Immediately redirect back to HTTPS with success
  function runHttpMode() {
    document.getElementById('httpMode').style.display = 'block';
    
    // Extract fwdid
    const { hashParams, questionParams } = parseParams(window.location.href);
    
    const fwdid = (hashParams.fwdid && hashParams.fwdid[0]) || 
                  (questionParams.fwdid && questionParams.fwdid[0]);
    
    if (fwdid) {
      console.log('Found fwdid:', fwdid, '- Redirecting back to HTTPS');
      
      const path = window.location.pathname;
      
      // Get all params except fwdid
      let params = [];
      for (let key in hashParams) {
        if (key !== 'fwdid') {
          hashParams[key].forEach(val => {
            params.push(`${key}=${encodeURIComponent(val)}`);
          });
        }
      }
      for (let key in questionParams) {
        if (key !== 'fwdid') {
          questionParams[key].forEach(val => {
            params.push(`${key}=${encodeURIComponent(val)}`);
          });
        }
      }
      
      // Add fwdidsuccess and return flag
      params.push(`fwdidsuccess=${fwdid}`);
      params.push(`return=true`);
      
      const httpsUrl = `https://info.filament3d.org${path}#${params.join('&')}`;
      
      console.log('Redirecting to HTTPS:', httpsUrl);
      document.getElementById('httpModeStatus').textContent = `Confirming success... redirecting to: ${httpsUrl}`;
      
      // Redirect immediately
      window.location.href = httpsUrl;
    } else {
      document.getElementById('httpModeStatus').textContent = 'No fwdid parameter found - already confirmed or direct access';
      console.log('No fwdid found - this is either a return from HTTPS or direct access');
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
