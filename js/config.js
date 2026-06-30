export const storeConfig = {
  whatsappNumber: "5575997092692",
  productsUrl: new URL("../data/products.json", import.meta.url).href,
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
    ? `Olá, tenho interesse no produto: ${product.name} - Valor: ${formatCurrency(product.price)}`
    : "Olá, tenho interesse nos produtos da MENEZZI.";

  return `https://wa.me/${storeConfig.whatsappNumber}?text=${encodeURIComponent(text)}`;
}
