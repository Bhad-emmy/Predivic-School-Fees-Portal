const env = import.meta.env;

export const siteConfig = {
  name: env.VITE_SCHOOL_NAME || "Predivic School",
  legalName: env.VITE_SCHOOL_LEGAL_NAME || "Predivic School",
  email: env.VITE_SCHOOL_EMAIL || "",
  phone: env.VITE_SCHOOL_PHONE || "",
  address: env.VITE_SCHOOL_ADDRESS || "",
  privacyEmail: env.VITE_PRIVACY_EMAIL || env.VITE_SCHOOL_EMAIL || "",
};

export const isContactConfigured = Boolean(
  siteConfig.email || siteConfig.phone || siteConfig.address
);
