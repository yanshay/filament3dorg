/*
Read all params (question and hash) to a single list, hash takes precedence

if running on Web:
get DB values (consoleAddress, consoleSecurityKey, forwardId, lastForwardSuccess)

if param fwdidsuccess && fwdidsuccess > lastForwardSuccess: set lastForwardSuccess to fwdidsuccess value

if consoleAddress or consoleSecurityKey are missing - load filament3d application on settings page - require configuration
if forwardId > lastForwardSuccess - load filament3d application on settings page - notify previous access to console fail, retry? fix config?

if no fwdidsuccess (first try): increase forwardId and store
combine all params to be after #hash
if not fwdIdSuccess: add hash param fwdid=fowardId value
if fwdIdSuccess: add hash param _sk= 

forward to console

if running on Console:

if fwdid: redirect back to Web with all params except fwdid + add fwdidsuccess=fwdid value
change the url to point to /inventory/location (history.replaceState(...))
else import(app) inventory
*/

// IndexedDB operations
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("SpoolEaseDB", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };
  });
}

async function getDBValue(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("settings", "readonly");
    const store = tx.objectStore("settings");
    const request = store.get(key);
    request.onsuccess = () =>
      resolve(request.result ? request.result.value : "");
    request.onerror = () => reject(request.error);
  });
}

async function setDBValue(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("settings", "readwrite");
    const store = tx.objectStore("settings");
    const request = store.put({ key, value });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Parse URL parameters
function getUrlParams() {
  const url = window.location.href;
  const params = {};

  const questionIndex = url.indexOf("?");
  const hashIndex = url.indexOf("#");

  if (questionIndex !== -1) {
    const end = hashIndex !== -1 ? hashIndex : url.length;
    const qString = url.substring(questionIndex + 1, end);
    qString.split("&").forEach((pair) => {
      if (pair) {
        const [key, value] = pair.split("=");
        if (key) {
          params[key] = decodeURIComponent(value || "");
        }
      }
    });
  }

  if (hashIndex !== -1) {
    const hString = url.substring(hashIndex + 1);
    hString.split("&").forEach((pair) => {
      if (pair) {
        const [key, value] = pair.split("=");
        if (key) {
          params[key] = decodeURIComponent(value || "");
        }
      }
    });
  }

  return params;
}

(async () => {
  let params = getUrlParams();

  console.log("params = ", params);

  const consoleAddress = await getDBValue("consoleAddress");
  const consoleSecurityKey = await getDBValue("consoleSecurityKey");
  const forwardId = Number((await getDBValue("forwardId")) || "0");
  const lastForwardSuccess = Number(
    (await getDBValue("lastForwardSuccess")) || "0",
  );

  // if param fwdidsuccess && fwdidsuccess > lastForwardSuccess: set lastForwardSuccess to fwdidsuccess value
  const fwdidsuccess = params.fwdidsuccess;

  // if consoleAddress or consoleSecurityKey are missing - load filament3d application on settings page - require configuration
  // Do it before changing any values that will cause future urls to fail on increased fwdid
  if (!consoleAddress) {
    console.log("Missing consoleAddress");
    const currentUrl = encodeURIComponent(window.location.href);
    window.location.href = `https://info.filament3d.org/L1/config.html?config=missingConfig&continue=${currentUrl}`;
    return;
  }

  // if (!consoleSecurityKey) {
  //   console.log("Missing consoleSecurityKey");
  //   return;
  // }

  if (!fwdidsuccess) {
    // Coming from Tag url
    // if forwardId > lastForwardSuccess - load filament3d application on settings page - notify previous access to console fail, retry? fix config?
    if (forwardId > lastForwardSuccess) {
      console.log("Last redirect failed");
      const currentUrl = encodeURIComponent(window.location.href);
      window.location.href = `https://info.filament3d.org/L1/config.html?config=forwardFailed&continue=${currentUrl}`;
      return;
    }

    // increase forwardId and store
    const newForwardId = String(forwardId + 1);
    await setDBValue("forwardId", newForwardId);

    params["fwdid"] = newForwardId;
  } else {
    // in case of return from console
    await setDBValue("lastForwardSuccess", fwdidsuccess);
    delete params["fwdidsuccess"];

    if (consoleSecurityKey) {
      params["sk"] = consoleSecurityKey;
    }
  }

  const path = window.location.pathname;
  const url = new URL(`http://${consoleAddress}${path}`);
  url.hash = new URLSearchParams(params).toString();
  const newUrl = url.toString();

  console.log("Forwarding to HTTP:", newUrl);
  window.location.href = newUrl;
})();
