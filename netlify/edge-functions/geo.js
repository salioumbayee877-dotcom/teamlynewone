const XOF_COUNTRIES = new Set(["SN", "CI", "ML", "BF", "BJ", "TG", "NE", "GW"]);
const EUR_COUNTRIES = new Set([
  "ES", "FR", "DE", "IT", "PT", "NL", "BE", "AT", "IE", "FI",
  "GR", "LU", "SK", "SI", "EE", "LV", "LT", "CY", "MT", "HR",
]);

export default async (request, context) => {
  const country = context.geo?.country?.code || "";
  let currency = "USD";
  if (XOF_COUNTRIES.has(country)) currency = "XOF";
  else if (EUR_COUNTRIES.has(country)) currency = "EUR";
  return new Response(JSON.stringify({ country, currency }), {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=3600",
    },
  });
};

export const config = { path: "/api/geo" };
