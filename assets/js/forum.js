/**
 * Forum Page Logic for KhmerResearch.com
 * Handles thread listing, creation, detail view, and replies.
 * Depends on firebase-init.js being loaded first.
 */
(function () {
  "use strict";

  var CATEGORIES = [
    { value: "general", label: "General Discussion" },
    { value: "technology", label: "Technology" },
    { value: "health", label: "Health" },
    { value: "economics", label: "Economics" },
    { value: "education", label: "Education" },
    { value: "agriculture", label: "Agriculture" },
    { value: "science", label: "Science" },
    { value: "history", label: "History & Culture" },
    { value: "law", label: "Law & Policy" },
    { value: "environment", label: "Environment" },
    { value: "question", label: "Questions" },
    { value: "feedback", label: "Site Feedback" }
  ];

  var currentView = "list"; // "list" | "detail" | "new"
  var currentThreadId = null;
  var currentFilter = "all";

  function init() {
    renderTabs();
    renderNewThreadButton();
    showThreadList();
    handleHashNavigation();
    window.addEventListener("hashchange", handleHashNavigation);
  }

  function handleHashNavigation() {
    var hash = window.location.hash;
    if (hash.indexOf("#thread/") === 0) {
      var threadId = hash.substring(8);
      showThreadDetail(threadId);
    } else if (hash === "#new") {
      showNewThreadForm();
    } else {
      showThreadList();
    }
  }

  function renderTabs() {
    var tabsContainer = document.getElementById("forum-tabs");
    if (!tabsContainer) return;

    var html = '<button class="kr-forum-tab active" data-filter="all">All</button>';
    html += '<button class="kr-forum-tab" data-filter="general">General</button>';
    html += '<button class="kr-forum-tab" data-filter="question">Questions</button>';
    html += '<button class="kr-forum-tab" data-filter="feedback">Feedback</button>';
    tabsContainer.innerHTML = html;

    tabsContainer.addEventListener("click", function (e) {
      var tab = e.target.closest(".kr-forum-tab");
      if (!tab) return;
      currentFilter = tab.getAttribute("data-filter");
      tabsContainer.querySelectorAll(".kr-forum-tab").forEach(function (t) {
        t.classList.remove("active");
      });
      tab.classList.add("active");
      showThreadList();
    });
  }

  function renderNewThreadButton() {
    var btn = document.getElementById("forum-new-btn");
    if (!btn) return;
    btn.onclick = function () {
      window.location.hash = "#new";
    };
  }

  function showThreadList() {
    currentView = "list";
    var content = document.getElementById("forum-content");
    content.innerHTML = '<div class="kr-loading">Loading discussions...</div>';

    document.getElementById("forum-tabs").style.display = "flex";
    document.getElementById("forum-new-btn").style.display = "inline-flex";

    window.KR.onReady(function () {
      var threadsRef = window.KR.dbRef("forum/threads");
      threadsRef.orderByChild("createdAt").limitToLast(100).once("value", function (snap) {
        var threads = [];
        snap.forEach(function (child) {
          var t = child.val();
          t._key = child.key;
          threads.push(t);
        });
        threads.reverse(); // newest first

        // Filter
        if (currentFilter !== "all") {
          threads = threads.filter(function (t) {
            return t.category === currentFilter;
          });
        }

        if (threads.length === 0) {
          content.innerHTML =
            '<div class="kr-empty">' +
              '<p>No discussions yet. Start the first one!</p>' +
            '</div>';
          return;
        }

        var html = '<div class="kr-thread-list">';
        for (var i = 0; i < threads.length; i++) {
          var t = threads[i];
          html +=
            '<div class="kr-thread-card" data-thread-id="' + t._key + '">' +
              '<div class="kr-thread-title">' + window.KR.escapeHtml(t.title) + '</div>' +
              '<div class="kr-thread-preview">' + window.KR.escapeHtml(t.body || "").substring(0, 200) + '</div>' +
              '<div class="kr-thread-meta">' +
                '<span class="kr-thread-category">' + window.KR.escapeHtml(getCategoryLabel(t.category)) + '</span>' +
                '<span>by ' + window.KR.escapeHtml(t.authorName || "Anonymous") + '</span>' +
                '<span>' + window.KR.formatTime(t.createdAt) + '</span>' +
                '<span>' + (t.replyCount || 0) + ' replies</span>' +
              '</div>' +
            '</div>';
        }
        html += '</div>';
        content.innerHTML = html;

        // Click handlers
        content.querySelectorAll(".kr-thread-card").forEach(function (card) {
          card.onclick = function () {
            var id = card.getAttribute("data-thread-id");
            window.location.hash = "#thread/" + id;
          };
        });
      });
    });
  }

  function showThreadDetail(threadId) {
    currentView = "detail";
    currentThreadId = threadId;
    var content = document.getElementById("forum-content");
    content.innerHTML = '<div class="kr-loading">Loading...</div>';

    document.getElementById("forum-tabs").style.display = "none";
    document.getElementById("forum-new-btn").style.display = "none";

    window.KR.onReady(function () {
      var threadRef = window.KR.dbRef("forum/threads/" + threadId);
      threadRef.once("value", function (snap) {
        var t = snap.val();
        if (!t) {
          content.innerHTML =
            '<a href="#" class="kr-back-link">&larr; Back to discussions</a>' +
            '<div class="kr-empty">Thread not found.</div>';
          return;
        }

        var html =
          '<a href="#" class="kr-back-link">&larr; Back to discussions</a>' +
          '<div class="kr-thread-detail">' +
            '<div class="kr-thread-detail-meta">' +
              '<span class="kr-thread-category">' + window.KR.escapeHtml(getCategoryLabel(t.category)) + '</span>' +
              ' &middot; ' + window.KR.escapeHtml(t.authorName || "Anonymous") +
              ' &middot; ' + window.KR.formatTime(t.createdAt) +
            '</div>' +
            '<h2>' + window.KR.escapeHtml(t.title) + '</h2>' +
            '<div class="kr-thread-detail-body">' + window.KR.escapeHtml(t.body || "") + '</div>' +
          '</div>' +
          '<div class="kr-replies">' +
            '<h3>Replies</h3>' +
            '<div id="replies-list"><div class="kr-loading">Loading replies...</div></div>' +
          '</div>' +
          '<div class="kr-reply-form" id="reply-form-section"></div>';

        content.innerHTML = html;

        // Load replies
        loadReplies(threadId);

        // Render reply form
        renderReplyForm(threadId);
      });
    });
  }

  function loadReplies(threadId) {
    var repliesRef = window.KR.dbRef("forum/replies/" + threadId);
    var list = document.getElementById("replies-list");

    repliesRef.orderByChild("createdAt").on("value", function (snap) {
      var replies = [];
      snap.forEach(function (child) {
        var r = child.val();
        r._key = child.key;
        replies.push(r);
      });

      if (replies.length === 0) {
        list.innerHTML = '<div class="kr-empty">No replies yet. Be the first to reply!</div>';
        return;
      }

      var html = "";
      for (var i = 0; i < replies.length; i++) {
        var r = replies[i];
        html +=
          '<div class="kr-reply">' +
            '<div class="kr-reply-header">' +
              '<strong>' + window.KR.escapeHtml(r.authorName || "Anonymous") + '</strong>' +
              '<span class="kr-reply-time">' + window.KR.formatTime(r.createdAt) + '</span>' +
            '</div>' +
            '<p class="kr-reply-body">' + window.KR.escapeHtml(r.body || "") + '</p>' +
          '</div>';
      }
      list.innerHTML = html;
    });
  }

  function renderReplyForm(threadId) {
    var section = document.getElementById("reply-form-section");

    function renderForUser(user) {
      if (!user) {
        section.innerHTML =
          '<div class="kr-new-thread" style="margin-top:16px">' +
            '<h3>Reply</h3>' +
            '<p style="color:var(--kr-text-secondary);font-size:14px;margin-bottom:12px">Sign in to reply:</p>' +
            '<div class="kr-auth-actions">' +
              '<button class="kr-btn kr-btn-google" onclick="KR.signInWithGoogle()">Sign in with Google</button>' +
              '<button class="kr-btn kr-btn-anon" onclick="KR.signInAnonymously()">Post Anonymously</button>' +
            '</div>' +
          '</div>';
        return;
      }

      var name = user.isAnonymous ? "Anonymous" : (user.displayName || user.email || "User");
      section.innerHTML =
        '<div class="kr-new-thread" style="margin-top:16px">' +
          '<h3>Reply as ' + window.KR.escapeHtml(name) + '</h3>' +
          '<div class="kr-form-group">' +
            '<textarea id="reply-text" placeholder="Write your reply..." rows="3" maxlength="2000"></textarea>' +
          '</div>' +
          '<div class="kr-form-actions">' +
            '<button class="kr-btn kr-btn-primary" id="reply-submit">Post Reply</button>' +
          '</div>' +
        '</div>';

      document.getElementById("reply-submit").onclick = function () {
        submitReply(threadId);
      };
    }

    document.addEventListener("kr-auth-changed", function (e) {
      if (currentView === "detail" && currentThreadId === threadId) {
        renderForUser(e.detail.user);
      }
    });

    // Render immediately if user state is known
    renderForUser(window.KR.currentUser);
  }

  function submitReply(threadId) {
    var user = window.KR.currentUser;
    if (!user) return;

    var textarea = document.getElementById("reply-text");
    var text = (textarea.value || "").trim();
    if (!text) return;
    if (text.length > 2000) {
      alert("Reply is too long (max 2000 characters).");
      return;
    }

    var replyData = {
      body: text,
      authorName: user.isAnonymous ? "Anonymous" : (user.displayName || user.email || "User"),
      authorUid: user.uid,
      isAnonymous: user.isAnonymous || false,
      createdAt: firebase.database.ServerValue.TIMESTAMP
    };

    var repliesRef = window.KR.dbRef("forum/replies/" + threadId);
    repliesRef.push(replyData).then(function () {
      textarea.value = "";
      // Increment reply count
      var threadRef = window.KR.dbRef("forum/threads/" + threadId + "/replyCount");
      threadRef.transaction(function (current) {
        return (current || 0) + 1;
      });
    }).catch(function (err) {
      console.error("Failed to post reply:", err);
      alert("Failed to post reply. Please try again.");
    });
  }

  function showNewThreadForm() {
    currentView = "new";
    var content = document.getElementById("forum-content");

    document.getElementById("forum-tabs").style.display = "none";
    document.getElementById("forum-new-btn").style.display = "none";

    function renderForm(user) {
      if (!user) {
        content.innerHTML =
          '<a href="#" class="kr-back-link">&larr; Back to discussions</a>' +
          '<div class="kr-new-thread">' +
            '<h3>Start a New Discussion</h3>' +
            '<p style="color:var(--kr-text-secondary);font-size:14px;margin-bottom:12px">Sign in to post:</p>' +
            '<div class="kr-auth-actions">' +
              '<button class="kr-btn kr-btn-google" onclick="KR.signInWithGoogle()">Sign in with Google</button>' +
              '<button class="kr-btn kr-btn-anon" onclick="KR.signInAnonymously()">Post Anonymously</button>' +
            '</div>' +
          '</div>';
        return;
      }

      var name = user.isAnonymous ? "Anonymous" : (user.displayName || user.email || "User");
      var catOptions = '<option value="">Select a category...</option>';
      for (var i = 0; i < CATEGORIES.length; i++) {
        catOptions += '<option value="' + CATEGORIES[i].value + '">' + CATEGORIES[i].label + '</option>';
      }

      content.innerHTML =
        '<a href="#" class="kr-back-link">&larr; Back to discussions</a>' +
        '<div class="kr-new-thread">' +
          '<h3>Start a New Discussion</h3>' +
          '<p style="color:var(--kr-text-muted);font-size:13px;margin-bottom:14px">Posting as: ' + window.KR.escapeHtml(name) + '</p>' +
          '<div class="kr-form-group">' +
            '<label for="thread-title">Title</label>' +
            '<input type="text" id="thread-title" placeholder="What would you like to discuss?" maxlength="200">' +
          '</div>' +
          '<div class="kr-form-group">' +
            '<label for="thread-category">Category</label>' +
            '<select id="thread-category">' + catOptions + '</select>' +
          '</div>' +
          '<div class="kr-form-group">' +
            '<label for="thread-body">Details</label>' +
            '<textarea id="thread-body" placeholder="Share your thoughts, questions, or ideas..." rows="6" maxlength="5000"></textarea>' +
          '</div>' +
          '<div class="kr-form-actions">' +
            '<button class="kr-btn kr-btn-secondary" onclick="window.location.hash=\'\'">Cancel</button>' +
            '<button class="kr-btn kr-btn-primary" id="thread-submit">Post Discussion</button>' +
          '</div>' +
        '</div>';

      document.getElementById("thread-submit").onclick = submitNewThread;
    }

    renderForm(window.KR.currentUser);

    document.addEventListener("kr-auth-changed", function handler(e) {
      if (currentView === "new") {
        renderForm(e.detail.user);
      }
    });
  }

  function submitNewThread() {
    var user = window.KR.currentUser;
    if (!user) return;

    var title = (document.getElementById("thread-title").value || "").trim();
    var category = document.getElementById("thread-category").value;
    var body = (document.getElementById("thread-body").value || "").trim();

    if (!title) { alert("Please enter a title."); return; }
    if (!category) { alert("Please select a category."); return; }
    if (!body) { alert("Please enter some details."); return; }
    if (title.length > 200) { alert("Title is too long (max 200 characters)."); return; }
    if (body.length > 5000) { alert("Body is too long (max 5000 characters)."); return; }

    var threadData = {
      title: title,
      body: body,
      category: category,
      authorName: user.isAnonymous ? "Anonymous" : (user.displayName || user.email || "User"),
      authorUid: user.uid,
      isAnonymous: user.isAnonymous || false,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      replyCount: 0
    };

    var threadsRef = window.KR.dbRef("forum/threads");
    threadsRef.push(threadData).then(function (ref) {
      window.location.hash = "#thread/" + ref.key;
    }).catch(function (err) {
      console.error("Failed to create thread:", err);
      alert("Failed to create discussion. Please try again.");
    });
  }

  function getCategoryLabel(value) {
    for (var i = 0; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i].value === value) return CATEGORIES[i].label;
    }
    return value || "General";
  }

  // Run when DOM and Firebase are ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      window.KR.onReady(init);
    });
  } else {
    window.KR.onReady(init);
  }
})();
