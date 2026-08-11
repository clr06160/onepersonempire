(() => {
  const slides = Array.from(document.querySelectorAll(".slide"));
  const total = slides.length;
  const currentEl = document.getElementById("current");
  const totalEl = document.getElementById("total");
  const progress = document.getElementById("progress");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");

  let index = 0;

  totalEl.textContent = String(total);

  function show(i) {
    index = Math.max(0, Math.min(total - 1, i));
    slides.forEach((slide, n) => {
      slide.classList.toggle("active", n === index);
    });
    currentEl.textContent = String(index + 1);
    progress.style.width = `${((index + 1) / total) * 100}%`;
    history.replaceState(null, "", `#${index + 1}`);
  }

  function next() {
    show(index + 1);
  }

  function prev() {
    show(index - 1);
  }

  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      prev();
    } else if (e.key === "Home") {
      e.preventDefault();
      show(0);
    } else if (e.key === "End") {
      e.preventDefault();
      show(total - 1);
    } else if (e.key === "f" || e.key === "F") {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    }
  });

  document.getElementById("deck").addEventListener("click", (e) => {
    if (e.target.closest("a, button, .deck-nav")) return;
    const mid = window.innerWidth / 2;
    if (e.clientX >= mid) next();
    else prev();
  });

  const hash = Number(location.hash.replace("#", ""));
  show(Number.isFinite(hash) && hash >= 1 ? hash - 1 : 0);
})();
