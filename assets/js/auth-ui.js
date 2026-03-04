/**
 * Auth UI Component for KhmerResearch.com
 * Renders a login/logout button bar that can be placed on any page.
 * Depends on firebase-init.js being loaded first.
 */
(function () {
  "use strict";

  function createAuthBar() {
    var bar = document.createElement("div");
    bar.className = "kr-auth-bar";
    bar.innerHTML =
      '<div class="kr-auth-inner">' +
        '<div class="kr-auth-status">' +
          '<span class="kr-auth-avatar"></span>' +
          '<span class="kr-auth-name">Loading...</span>' +
        '</div>' +
        '<div class="kr-auth-actions"></div>' +
      '</div>';
    return bar;
  }

  function renderLoggedOut(bar) {
    var actions = bar.querySelector(".kr-auth-actions");
    var status = bar.querySelector(".kr-auth-name");
    var avatar = bar.querySelector(".kr-auth-avatar");
    status.textContent = "";
    avatar.textContent = "";
    avatar.style.backgroundImage = "";
    actions.innerHTML =
      '<button class="kr-btn kr-btn-google" onclick="KR.signInWithGoogle()">Sign in with Google</button>' +
      '<button class="kr-btn kr-btn-anon" onclick="KR.signInAnonymously()">Post Anonymously</button>';
  }

  function renderLoggedIn(bar, user) {
    var actions = bar.querySelector(".kr-auth-actions");
    var status = bar.querySelector(".kr-auth-name");
    var avatar = bar.querySelector(".kr-auth-avatar");

    if (user.isAnonymous) {
      status.textContent = "Anonymous User";
      avatar.textContent = "?";
      avatar.style.backgroundImage = "";
    } else {
      status.textContent = user.displayName || user.email || "User";
      if (user.photoURL) {
        avatar.style.backgroundImage = "url(" + user.photoURL + ")";
        avatar.textContent = "";
      } else {
        avatar.textContent = (user.displayName || "U").charAt(0).toUpperCase();
        avatar.style.backgroundImage = "";
      }
    }

    actions.innerHTML =
      '<button class="kr-btn kr-btn-signout" onclick="KR.signOut()">Sign Out</button>';
  }

  function init() {
    // Insert auth bar into any element with class "kr-auth-container"
    var containers = document.querySelectorAll(".kr-auth-container");
    if (containers.length === 0) return;

    var bars = [];
    for (var i = 0; i < containers.length; i++) {
      var bar = createAuthBar();
      containers[i].appendChild(bar);
      bars.push(bar);
    }

    // Update all bars on auth change
    document.addEventListener("kr-auth-changed", function (e) {
      var user = e.detail.user;
      for (var j = 0; j < bars.length; j++) {
        if (user) {
          renderLoggedIn(bars[j], user);
        } else {
          renderLoggedOut(bars[j]);
        }
      }
    });

    // If already initialized, update immediately
    if (window.KR && window.KR.currentUser !== undefined) {
      var user = window.KR.currentUser;
      for (var k = 0; k < bars.length; k++) {
        if (user) {
          renderLoggedIn(bars[k], user);
        } else {
          renderLoggedOut(bars[k]);
        }
      }
    }
  }

  // Run when DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
