import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Prakash Pump — Marketing Command Center" },
      { name: "description", content: "Analytics, campaigns, CRM and market intelligence for the Prakash Pump marketing team." },
      { property: "og:title", content: "Prakash Pump — Marketing Command Center" },
      { property: "og:description", content: "Analytics, campaigns, CRM and market intelligence for the Prakash Pump marketing team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/overview" });
  },
});
