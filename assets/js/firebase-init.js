/**
 * Firebase Initialization & Auth for KhmerResearch.com
 * Shared module used by forum, Q&A, and page widget.
 * Loads Firebase SDK via CDN compat mode for broad browser support.
 */
(function () {
  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyCJLYCrlStvZRTy9311G9Xa1BabDlpwFsc",
    authDomain: "khmer-research-fb.firebaseapp.com",
    databaseURL: "https://khmer-research-fb-default-rtdb.firebaseio.com",
    projectId: "khmer-research-fb",
    storageBucket: "khmer-research-fb.firebasestorage.app",
    messagingSenderId: "444625530720",
    appId: "1:444625530720:web:bcf3114ad1d1033ab4f805"
  };

  // Prevent double-init
  if (window.KR && window.KR._initialized) return;

  window.KR = window.KR || {};
  window.KR._initialized = false;
  window.KR._readyCallbacks = [];
  window.KR.currentUser = null;

  /**
   * Register a callback to run when Firebase is ready.
   */
  window.KR.onReady = function (cb) {
    if (window.KR._initialized) {
      cb();
    } else {
      window.KR._readyCallbacks.push(cb);
    }
  };

  /**
   * Get display name for current user.
   */
  window.KR.getDisplayName = function () {
    var u = window.KR.currentUser;
    if (!u) return "Anonymous";
    if (u.isAnonymous) return "Anonymous";
    return u.displayName || u.email || "User";
  };

  /**
   * Sign in anonymously.
   */
  window.KR.signInAnonymously = function () {
    return firebase.auth().signInAnonymously();
  };

  /**
   * Sign in with Google popup.
   */
  window.KR.signInWithGoogle = function () {
    var provider = new firebase.auth.GoogleAuthProvider();
    return firebase.auth().signInWithPopup(provider);
  };

  /**
   * Sign out.
   */
  window.KR.signOut = function () {
    return firebase.auth().signOut();
  };

  /**
   * Get a Firebase RTDB reference.
   */
  window.KR.dbRef = function (path) {
    return firebase.database().ref(path);
  };

  /**
   * Encode a URL path for use as a Firebase key.
   * Replaces characters not allowed in Firebase keys: . # $ [ ] /
   */
  window.KR.encodePathKey = function (path) {
    return (path || "/")
      .replace(/\./g, "_dot_")
      .replace(/#/g, "_hash_")
      .replace(/\$/g, "_dollar_")
      .replace(/\[/g, "_lb_")
      .replace(/\]/g, "_rb_")
      .replace(/\//g, "_sl_");
  };

  /**
   * Format a timestamp to a human-readable relative or absolute string.
   */
  window.KR.formatTime = function (ts) {
    if (!ts) return "";
    var now = Date.now();
    var diff = now - ts;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
    if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
    if (diff < 604800000) return Math.floor(diff / 86400000) + "d ago";
    var d = new Date(ts);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  /**
   * Sanitize user text input (prevent XSS).
   */
  window.KR.escapeHtml = function (str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str || ""));
    return div.innerHTML;
  };

  // Load Firebase SDK scripts dynamically
  // var RECAPTCHA_SITE_KEY = "6Le-L3wsAAAAAF1AAbkCEQBVGOnZFwUfigT40cIi";
  var RECAPTCHA_SITE_KEY = "6LfgQXwsAAAAADQOlj-L1UkVcWjJkF4juHqQsV0A";
  var ENABLE_APP_CHECK = false; // Temporary toggle

  var sdkBase = "https://www.gstatic.com/firebasejs/10.14.1/";
  var scripts = [
    sdkBase + "firebase-app-compat.js",
    sdkBase + "firebase-auth-compat.js",
    sdkBase + "firebase-database-compat.js",
    sdkBase + "firebase-app-check-compat.js"
  ];

  var loaded = 0;
  function onScriptLoad() {
    loaded++;
    if (loaded < scripts.length) return;

    // All scripts loaded — initialize
    firebase.initializeApp(FIREBASE_CONFIG);

    // App Check is temporarily disabled.
    // Re-enable later by setting ENABLE_APP_CHECK = true.
    if (ENABLE_APP_CHECK) {
      try {
        var host = (window.location && window.location.hostname) || "";
        var isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "[::1]";

        // Local development with RTDB App Check enforcement:
        // use Firebase App Check debug token flow (register token in Firebase Console once).
        if (isLocalhost && typeof self.FIREBASE_APPCHECK_DEBUG_TOKEN === "undefined") {
          self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        }

        var appCheck = firebase.appCheck();
        appCheck.activate(
          new firebase.appCheck.ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
          /* isTokenAutoRefreshEnabled= */ true
        );
      } catch (e) {
        // Non-fatal: site continues to function without App Check
        console.warn("[KR] App Check activation skipped:", e.message || e);
      }
    }

    // Listen for auth state
    firebase.auth().onAuthStateChanged(function (user) {
      window.KR.currentUser = user;
      // Dispatch custom event for UI components
      document.dispatchEvent(new CustomEvent("kr-auth-changed", { detail: { user: user } }));
    });

    window.KR._initialized = true;
    window.KR._readyCallbacks.forEach(function (cb) { cb(); });
    window.KR._readyCallbacks = [];
  }

  // Load scripts sequentially to ensure dependency order
  function loadNext(i) {
    if (i >= scripts.length) return;
    var s = document.createElement("script");
    s.src = scripts[i];
    s.onload = function () {
      onScriptLoad();
      loadNext(i + 1);
    };
    s.onerror = function () {
      console.error("Failed to load Firebase SDK: " + scripts[i]);
    };
    document.head.appendChild(s);
  }

  loadNext(0);
})();
