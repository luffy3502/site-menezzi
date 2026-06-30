export function CategoryFilter(container, onChange) {
  let activeCategory = "Todos";

  function render(categories) {
    const items = ["Todos", ...categories];
    container.innerHTML = items
      .map(
        (category) => `
          <button
            class="filter-button ${category === activeCategory ? "is-active" : ""}"
            type="button"
            data-category="${category}"
          >${category}</button>
        `
      )
      .join("");
  }

  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    activeCategory = button.dataset.category;
    container.querySelectorAll("[data-category]").forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
    onChange(activeCategory);
  });

  return {
    render,
    getActiveCategory: () => activeCategory,
  };
}
