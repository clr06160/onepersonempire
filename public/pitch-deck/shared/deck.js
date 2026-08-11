(() => {
  const slides = Array.from(document.querySelectorAll(".slide"));
  const total = slides.length;
  const currentEl = document.getElementById("current");
  const totalEl = document.getElementById("total");
  const progress = document.getElementById("progress");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  if (!slides.length) return;

  let index = 0;
  if (totalEl) totalEl.textContent = String(total);

  function show(i) {
    index = Math.max(0, Math.min(total - 1, i));
    slides.forEach((slide, n) => {
      slide.classList.toggle("active", n === index);
    });
    if (currentEl) currentEl.textContent = String(index + 1);
    if (progress) progress.style.width = `${((index + 1) / total) * 100}%`;
    history.replaceState(null, "", `#${index + 1}`);
  }

  function next() {
    show(index + 1);
  }
  function prev() {
    show(index - 1);
  }

  prevBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    prev();
  });
  nextBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    next();
  });

  document.addEventListener("keydown", (e) => {
    if (["ArrowRight", "PageDown", " "].includes(e.key)) {
      e.preventDefault();
      next();
    } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
      e.preventDefault();
      prev();
    } else if (e.key === "Home") {
      e.preventDefault();
      show(0);
    } else if (e.key === "End") {
      e.preventDefault();
      show(total - 1);
    } else if (e.key === "f" || e.key === "F") {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
      else document.exitFullscreen?.();
    }
  });

  document.getElementById("deck")?.addEventListener("click", (e) => {
    if (e.target.closest("a, button, .deck-nav, .topbar")) return;
    if (e.clientX >= window.innerWidth / 2) next();
    else prev();
  });

  const hash = Number(location.hash.replace("#", ""));
  show(Number.isFinite(hash) && hash >= 1 ? hash - 1 : 0);
})();
