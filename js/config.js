export const storeConfig = {
  whatsappNumber: "5575997092692",
  productsApiUrl: "/api/products",
  adminProductsApiUrl: "/api/products?admin=1",
  uploadApiUrl: "/api/upload",
};

export function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function buildWhatsappUrl(product) {
  const text = product
    ? `Olá!\n\nTenho interesse no produto:\n\n*${product.name}*\n\nValor: ${formatCurrency(product.price)}\n\nGostaria de mais informações.`
    : "Olá! Gostaria de mais informações sobre os produtos da MENEZZI.";

  return `https://wa.me/${storeConfig.whatsappNumber}?text=${encodeURIComponent(text)}`;
}
