type ProviderConfig = {
  id: "google" | "linkedin" | "facebook";
  label: string;
  helper: string;
  envKeys: readonly [string, string];
  logo: string;
};

export const oauthProviders: readonly ProviderConfig[] = [
  {
    id: "google",
    label: "Google",
    helper: "Calendar + login",
    envKeys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    logo: "/logos/google.svg",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    helper: "LinkedIn posting",
    envKeys: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
    logo: "/logos/linkedin.svg",
  },
  {
    id: "facebook",
    label: "Facebook",
    helper: "Facebook posting",
    envKeys: ["FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET"],
    logo: "/logos/facebook.svg",
  },
] as const;

export function providerIsConfigured(envKeys: readonly string[]) {
  return envKeys.every((key) => Boolean(process.env[key]));
}

export function getEnabledProviders() {
  return oauthProviders.filter((provider) =>
    providerIsConfigured(provider.envKeys),
  );
}

