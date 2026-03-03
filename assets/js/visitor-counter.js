/**
 * Visitor Counter for KhmerResearch.com
 * Uses Firebase Realtime Database to track and display total site visitors.
 * - Increments count once per session (sessionStorage dedup)
 * - Displays count in any element with class "visitor-count"
 * - Security rules enforce increment-by-1-only writes
 */
(function () {
  var FIREBASE_DB_URL = "https://khmer-research-fb-default-rtdb.firebaseio.com";
  var COUNTER_PATH = "/visitors/count.json";
  var SESSION_KEY = "kr_visitor_counted";

  function formatNumber(n) {
    if (n >= 1000) {
      return n.toLocaleString();
    }
    return String(n);
  }

  function displayCount(count) {
    var els = document.querySelectorAll(".visitor-count");
    for (var i = 0; i < els.length; i++) {
      els[i].textContent = formatNumber(count);
    }
  }

  function getCount(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", FIREBASE_DB_URL + COUNTER_PATH, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          var val = JSON.parse(xhr.responseText);
          callback(null, val || 0);
        } else {
          callback(new Error("Failed to read counter"));
        }
      }
    };
    xhr.send();
  }

  function incrementCount(currentVal, callback) {
    var newVal = (currentVal || 0) + 1;
    var xhr = new XMLHttpRequest();
    // Use conditional PUT with ETag-like behavior via REST API
    // The security rules enforce newData === oldData + 1
    xhr.open("PUT", FIREBASE_DB_URL + COUNTER_PATH, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          callback(null, newVal);
        } else {
          // Retry once on conflict (another visitor incremented at the same time)
          getCount(function (err, freshVal) {
            if (err) { callback(err); return; }
            var retryVal = (freshVal || 0) + 1;
            var xhr2 = new XMLHttpRequest();
            xhr2.open("PUT", FIREBASE_DB_URL + COUNTER_PATH, true);
            xhr2.setRequestHeader("Content-Type", "application/json");
            xhr2.onreadystatechange = function () {
              if (xhr2.readyState === 4) {
                if (xhr2.status === 200) {
                  callback(null, retryVal);
                } else {
                  callback(null, freshVal); // Show current count even if write fails
                }
              }
            };
            xhr2.send(JSON.stringify(retryVal));
          });
        }
      }
    };
    xhr.send(JSON.stringify(newVal));
  }

  // Main logic
  function init() {
    var alreadyCounted = false;
    try {
      alreadyCounted = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch (e) { /* sessionStorage unavailable */ }

    if (alreadyCounted) {
      // Just read and display current count
      getCount(function (err, count) {
        if (!err) displayCount(count);
      });
    } else {
      // Read current count, increment, then display
      getCount(function (err, count) {
        if (err) return;
        incrementCount(count, function (err2, newCount) {
          if (!err2) {
            displayCount(newCount);
            try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (e) { }
          } else {
            displayCount(count);
          }
        });
      });
    }
  }

  // Run after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
