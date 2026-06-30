export const storeConfig = {
  whatsappNumber: "5575997092692",
  productsApiUrl: "/api/products",
  adminProductsApiUrl: "/api/products?admin=1",
  uploadApiUrl: "/api/upload",
  adminContentApiUrl: "/api/admin-content",
  storefrontContentApiUrl: "/api/storefront-content",
};

export const categoryOptions = ["Bolsas", "Carteiras", "Mochilas", "Acessorios", "Promocoes", "Outros"];

export const offerTypes = [
  { value: "sem_oferta", label: "Sem oferta" },
  { value: "oferta_semana", label: "Oferta da semana" },
  { value: "promocao", label: "Promocao" },
  { value: "lancamento", label: "Lancamento" },
  { value: "mais_vendido", label: "Mais vendido" },
];

export function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function createProductSlug(name) {
  return String(name || "produto")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function productPath(product) {
  return `/produto/${createProductSlug(product?.name || product?.id || "produto")}`;
}

export function absoluteProductUrl(product) {
  if (typeof window === "undefined") return productPath(product);
  return new URL(productPath(product), window.location.origin).href;
}

export function getOfferType(product) {
  if (product?.offerType) return product.offerType;
  return product?.weeklyOffer ? "oferta_semana" : "sem_oferta";
}

export function getOfferLabel(productOrType) {
  const value = typeof productOrType === "string" ? productOrType : getOfferType(productOrType);
  return offerTypes.find((offer) => offer.value === value)?.label || "Oferta";
}

export function buildWhatsappUrl(product) {
  const text = product
    ? `Ola! Tenho interesse neste produto.

Produto:
${product.name}

Preco:
${formatCurrency(product.price)}

Categoria:
${product.category}

Link do produto:
${absoluteProductUrl(product)}

Gostaria de mais informacoes.`
    : "Ola! Tenho interesse nos produtos da MENEZZI.";

  return `https://wa.me/${storeConfig.whatsappNumber}?text=${encodeURIComponent(text)}`;
}
