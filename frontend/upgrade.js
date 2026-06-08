document.addEventListener("DOMContentLoaded", () => {
  const recordsList = document.getElementById("records-list");
  const activeProjects = document.querySelector(".stat-card:nth-child(1) strong");
  const notesThisWeek = document.querySelector(".stat-card:nth-child(2) strong");
  const actionsOutstanding = document.querySelector(".stat-card:nth-child(4) strong");

  function normalize(value = "") {
    return String(value).trim().toLowerCase();
  }

  function decorateRecordCards() {
    if (!recordsList) return;

    const cards = [...recordsList.querySelectorAll(".record-item")];
    const projects = new Set();
    let highPriorityCount = 0;
    let recentCount = 0;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    cards.forEach((card) => {
      const title = card.querySelector("h3")?.textContent?.trim();
      if (title) projects.add(title);

      const meta = [...card.querySelectorAll(".record-meta span")];
      const priority = meta.find((item) => normalize(item.textContent).includes("priority"));
      const created = meta.at(-1)?.textContent;

      card.classList.remove("priority-high", "priority-medium", "priority-low");

      if (priority) {
        const value = normalize(priority.textContent);
        if (value.includes("high")) {
          card.classList.add("priority-high");
          highPriorityCount += 1;
        } else if (value.includes("medium")) {
          card.classList.add("priority-medium");
        } else if (value.includes("low")) {
          card.classList.add("priority-low");
        }
      }

      if (created) {
        const date = new Date(created);
        if (!Number.isNaN(date.getTime()) && date.getTime() >= sevenDaysAgo) {
          recentCount += 1;
        }
      }
    });

    if (activeProjects) activeProjects.textContent = String(projects.size || cards.length);
    if (notesThisWeek) notesThisWeek.textContent = String(recentCount);
    if (actionsOutstanding) actionsOutstanding.textContent = String(highPriorityCount);
  }

  if (recordsList) {
    const observer = new MutationObserver(decorateRecordCards);
    observer.observe(recordsList, { childList: true, subtree: true });
    decorateRecordCards();
  }
});