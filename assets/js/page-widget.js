/**
 * Page Comment & Like Widget for KhmerResearch.com
 * Floating button that opens a slide-in panel with:
 *  - Thumbs up (like) counter + button
 *  - Comments list + add comment form
 * Data stored per page path in Firebase RTDB.
 * Depends on firebase-init.js being loaded first.
 */
(function () {
  "use strict";

  var PAGE_KEY = null;
  var panelOpen = false;
  var fab = null;
  var panel = null;
  var likeCount = 0;
  var userLiked = false;

  function getPageKey() {
    var path = window.location.pathname;
    return window.KR.encodePathKey(path);
  }

  function createFab() {
    fab = document.createElement("button");
    fab.className = "kr-widget-fab";
    fab.setAttribute("aria-label", "Open comments panel");
    fab.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
      '</svg>' +
      '<span class="kr-widget-fab-badge" style="display:none">0</span>';
    fab.onclick = togglePanel;
    document.body.appendChild(fab);
  }

  function createPanel() {
    panel = document.createElement("div");
    panel.className = "kr-widget-panel";
    panel.innerHTML =
      '<div class="kr-widget-panel-header">' +
        '<h3>Community</h3>' +
        '<button class="kr-widget-close" onclick="this.closest(\'.kr-widget-panel\').classList.remove(\'open\')">&times;</button>' +
      '</div>' +
      '<div class="kr-widget-like-section">' +
        '<button class="kr-widget-like-btn" id="kr-like-btn">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>' +
            '<path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>' +
          '</svg>' +
          '<span id="kr-like-count">0</span> Likes' +
        '</button>' +
      '</div>' +
      '<div class="kr-widget-comments-section">' +
        '<h4>Comments</h4>' +
        '<div class="kr-widget-comments-list" id="kr-comments-list">' +
          '<p class="kr-widget-empty">No comments yet. Be the first!</p>' +
        '</div>' +
        '<div class="kr-widget-comment-form" id="kr-comment-form">' +
          '<div class="kr-widget-auth-prompt" id="kr-auth-prompt">' +
            '<p>Sign in to comment:</p>' +
            '<button class="kr-btn kr-btn-google kr-btn-sm" onclick="KR.signInWithGoogle()">Google</button>' +
            '<button class="kr-btn kr-btn-anon kr-btn-sm" onclick="KR.signInAnonymously()">Anonymous</button>' +
          '</div>' +
          '<div class="kr-widget-comment-input" id="kr-comment-input" style="display:none">' +
            '<div class="kr-widget-comment-user" id="kr-comment-user"></div>' +
            '<textarea id="kr-comment-text" placeholder="Write a comment..." rows="3" maxlength="1000"></textarea>' +
            '<div class="kr-widget-comment-actions">' +
              '<button class="kr-btn kr-btn-primary kr-btn-sm" id="kr-comment-submit">Post Comment</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);

    // Wire up close button
    panel.querySelector(".kr-widget-close").onclick = function () {
      togglePanel();
    };

    // Wire up like button
    document.getElementById("kr-like-btn").onclick = handleLike;

    // Wire up submit
    document.getElementById("kr-comment-submit").onclick = handleCommentSubmit;
  }

  function togglePanel() {
    panelOpen = !panelOpen;
    if (panelOpen) {
      panel.classList.add("open");
      fab.classList.add("active");
    } else {
      panel.classList.remove("open");
      fab.classList.remove("active");
    }
  }

  function handleLike() {
    var user = window.KR.currentUser;
    if (!user) {
      // Auto sign-in anonymously for likes
      window.KR.signInAnonymously().then(function () {
        doLike();
      });
      return;
    }
    doLike();
  }

  function doLike() {
    var user = window.KR.currentUser;
    if (!user) return;
    var uid = user.uid;
    var likesRef = window.KR.dbRef("pages/" + PAGE_KEY + "/likes");
    var userLikeRef = likesRef.child("users/" + uid);

    if (userLiked) {
      // Unlike
      userLikeRef.remove();
      likesRef.child("count").transaction(function (current) {
        return Math.max((current || 0) - 1, 0);
      });
    } else {
      // Like
      userLikeRef.set(true);
      likesRef.child("count").transaction(function (current) {
        return (current || 0) + 1;
      });
    }
  }

  function handleCommentSubmit() {
    var user = window.KR.currentUser;
    if (!user) return;

    var textarea = document.getElementById("kr-comment-text");
    var text = (textarea.value || "").trim();
    if (!text) return;
    if (text.length > 1000) {
      alert("Comment is too long (max 1000 characters).");
      return;
    }

    var commentsRef = window.KR.dbRef("pages/" + PAGE_KEY + "/comments");
    var commentData = {
      body: text,
      authorName: user.isAnonymous ? "Anonymous" : (user.displayName || user.email || "User"),
      authorUid: user.uid,
      isAnonymous: user.isAnonymous || false,
      createdAt: firebase.database.ServerValue.TIMESTAMP
    };

    commentsRef.push(commentData).then(function () {
      textarea.value = "";
    }).catch(function (err) {
      console.error("Failed to post comment:", err);
      alert("Failed to post comment. Please try again.");
    });
  }

  function listenLikes() {
    var likesRef = window.KR.dbRef("pages/" + PAGE_KEY + "/likes");

    // Listen for count changes
    likesRef.child("count").on("value", function (snap) {
      likeCount = snap.val() || 0;
      var el = document.getElementById("kr-like-count");
      if (el) el.textContent = likeCount;
      updateFabBadge();
    });

    // Listen for current user's like status
    document.addEventListener("kr-auth-changed", function (e) {
      var user = e.detail.user;
      if (user) {
        likesRef.child("users/" + user.uid).on("value", function (snap) {
          userLiked = !!snap.val();
          var btn = document.getElementById("kr-like-btn");
          if (btn) {
            if (userLiked) {
              btn.classList.add("liked");
            } else {
              btn.classList.remove("liked");
            }
          }
        });
      }
    });
  }

  function listenComments() {
    var commentsRef = window.KR.dbRef("pages/" + PAGE_KEY + "/comments");
    var list = document.getElementById("kr-comments-list");

    commentsRef.orderByChild("createdAt").on("value", function (snap) {
      var comments = [];
      snap.forEach(function (child) {
        var c = child.val();
        c._key = child.key;
        comments.push(c);
      });

      if (comments.length === 0) {
        list.innerHTML = '<p class="kr-widget-empty">No comments yet. Be the first!</p>';
      } else {
        var html = "";
        for (var i = comments.length - 1; i >= 0; i--) {
          var c = comments[i];
          html +=
            '<div class="kr-widget-comment">' +
              '<div class="kr-widget-comment-header">' +
                '<strong>' + window.KR.escapeHtml(c.authorName) + '</strong>' +
                '<span class="kr-widget-comment-time">' + window.KR.formatTime(c.createdAt) + '</span>' +
              '</div>' +
              '<p>' + window.KR.escapeHtml(c.body) + '</p>' +
            '</div>';
        }
        list.innerHTML = html;
      }

      updateFabBadge();
    });

    commentsRef.once("value", function (snap) {
      var count = snap.numChildren();
      updateFabBadge(count);
    });
  }

  function updateFabBadge(commentCount) {
    var badge = fab.querySelector(".kr-widget-fab-badge");
    if (commentCount === undefined) {
      // Just update from likeCount
      return;
    }
    if (commentCount > 0) {
      badge.textContent = commentCount;
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  }

  function updateAuthUI() {
    var prompt = document.getElementById("kr-auth-prompt");
    var input = document.getElementById("kr-comment-input");
    var userEl = document.getElementById("kr-comment-user");

    document.addEventListener("kr-auth-changed", function (e) {
      var user = e.detail.user;
      if (user) {
        prompt.style.display = "none";
        input.style.display = "block";
        if (user.isAnonymous) {
          userEl.textContent = "Posting as Anonymous";
        } else {
          userEl.textContent = "Posting as " + (user.displayName || user.email || "User");
        }
      } else {
        prompt.style.display = "block";
        input.style.display = "none";
        userEl.textContent = "";
      }
    });
  }

  function init() {
    // Only show widget on article pages (inside /papers/ with .html extension)
    var path = window.location.pathname;
    if (path.indexOf("/papers/") === -1 && path.indexOf("/forum") === -1 && path.indexOf("/qa") === -1) return;
    // Skip index pages
    if (path.match(/\/papers\/?$/) || path.match(/\/papers\/[^/]+\/?$/)) return;

    PAGE_KEY = getPageKey();
    createFab();
    createPanel();

    window.KR.onReady(function () {
      listenLikes();
      listenComments();
      updateAuthUI();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
