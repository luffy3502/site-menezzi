import { ProductCard } from "./ProductCard.js";

export function ProductGrid(container, emptyState, onViewProduct) {
  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view-product]");
    if (button) onViewProduct(button.dataset.viewProduct);
  });

  function render(products) {
    container.innerHTML = products.map(ProductCard).join("");
    if (emptyState) emptyState.hidden = products.length > 0;
  }

  return { render };
}
