self.addEventListener("install", e => {
  e.waitUntil(
    caches.open("cyber-quiz-v1").then(cache => {
      return cache.addAll([
        "index.html",
        "quiz.html",
        "answer.html",
        "style.css",
        "script.js",
        "manifest.json"
      ]);
    })
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
