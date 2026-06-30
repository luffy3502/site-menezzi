const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  productImagesBucket: "products",
};

function decodeJwtPayload(token) {
  if (!token || !token.includes(".")) return null;

  try {
    const [, payload] = token.split(".");
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch (error) {
    return null;
  }
}

function projectRefFromUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    const match = hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return match ? match[1] : "";
  } catch (error) {
    return "";
  }
}

function projectRefFromKey(key) {
  const payload = decodeJwtPayload(key);
  return payload?.ref || projectRefFromUrl(payload?.iss || "");
}

function getSupabaseConfigReport() {
  const urlProjectRef = projectRefFromUrl(supabaseConfig.url);
  const anonProjectRef = projectRefFromKey(supabaseConfig.anonKey);
  const serviceProjectRef = projectRefFromKey(supabaseConfig.serviceRoleKey);
  const expectedProjectRef = process.env.SUPABASE_PROJECT_REF || process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF || "";
  const issues = [];

  if (!supabaseConfig.url) issues.push("NEXT_PUBLIC_SUPABASE_URL ausente.");
  if (!supabaseConfig.anonKey) issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY ausente.");
  if (!supabaseConfig.serviceRoleKey) issues.push("SUPABASE_SERVICE_ROLE_KEY ausente.");
  if (supabaseConfig.url && !urlProjectRef) issues.push("NEXT_PUBLIC_SUPABASE_URL nao parece ser uma URL *.supabase.co valida.");
  if (urlProjectRef && anonProjectRef && urlProjectRef !== anonProjectRef) {
    issues.push("NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY apontam para projetos Supabase diferentes.");
  }
  if (urlProjectRef && serviceProjectRef && urlProjectRef !== serviceProjectRef) {
    issues.push("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY apontam para projetos Supabase diferentes.");
  }
  if (expectedProjectRef && urlProjectRef && expectedProjectRef !== urlProjectRef) {
    issues.push("NEXT_PUBLIC_SUPABASE_URL nao aponta para o projeto Supabase esperado.");
  }

  return {
    urlConfigured: Boolean(supabaseConfig.url),
    anonKeyConfigured: Boolean(supabaseConfig.anonKey),
    serviceRoleKeyConfigured: Boolean(supabaseConfig.serviceRoleKey),
    urlProjectRef,
    anonProjectRef,
    serviceProjectRef,
    expectedProjectRef,
    issues,
  };
}

module.exports = { getSupabaseConfigReport, supabaseConfig };
