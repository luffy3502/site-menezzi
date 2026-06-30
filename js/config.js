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
    ? `Olá! Tenho interesse no produto: ${product.name} - Valor: ${formatCurrency(product.price)}`
    : "Olá! Tenho interesse nos produtos da MENEZZI.";

  return `https://wa.me/${storeConfig.whatsappNumber}?text=${encodeURIComponent(text)}`;
}
