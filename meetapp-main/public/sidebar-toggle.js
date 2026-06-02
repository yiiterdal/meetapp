(function () {
  const STORAGE_KEY = "meetinglySidebarCollapsed";

  function syncButtons() {
    const collapsed = document.documentElement.classList.contains("sidebar-collapsed");
    document.querySelectorAll(".sidebar-toggle-btn").forEach((btn) => {
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      btn.title = collapsed ? "Expand menu" : "Collapse menu";
      btn.setAttribute("aria-label", collapsed ? "Expand navigation" : "Collapse navigation");
      btn.textContent = collapsed ? "\u203a" : "\u2039";
    });
  }

  function init() {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") {
        document.documentElement.classList.add("sidebar-collapsed");
      } else {
        document.documentElement.classList.remove("sidebar-collapsed");
      }
    } catch {
      document.documentElement.classList.remove("sidebar-collapsed");
    }
    syncButtons();
    document.querySelectorAll(".sidebar-toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.documentElement.classList.toggle("sidebar-collapsed");
        try {
          localStorage.setItem(
            STORAGE_KEY,
            document.documentElement.classList.contains("sidebar-collapsed") ? "1" : "0"
          );
        } catch {
          /* ignore */
        }
        syncButtons();
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
