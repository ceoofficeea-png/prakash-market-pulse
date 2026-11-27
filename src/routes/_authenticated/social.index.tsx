import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { PageHeader } from "@/components/app/page";
import { OverallView, PlatformView } from "@/components/app/social-platform-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PLATFORM_META, PLATFORM_ORDER, type PlatformId } from "@/lib/social-platforms";

export const Route = createFileRoute("/_authenticated/social/")({
  head: () => ({
    meta: [
      { title: "Social Media Management \u2014 Prakash Pump" },
      {
        name: "description",
        content:
          "Social Media Management analytics and records for the Prakash Pump marketing team.",
      },
      { property: "og:title", content: "Social Media Management \u2014 Prakash Pump" },
      {
        property: "og:description",
        content:
          "Social Media Management analytics and records for the Prakash Pump marketing team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SocialPage,
});

function SocialPage() {
  const [tab, setTab] = useState<string>("overall");

  return (
    <>
      <PageHeader
        eyebrow="02 · Social Media Management"
        title="Social media"
        description="Organic audience, engagement and publishing across Facebook, Instagram, LinkedIn, YouTube, X, Snapchat and TikTok."
        filters={["date", "country"]}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 h-auto w-full flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="overall">Overall view</TabsTrigger>
          {PLATFORM_ORDER.map((platform) => (
            <TabsTrigger key={platform} value={platform} className="gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: PLATFORM_META[platform].color }}
              />
              {PLATFORM_META[platform].tabLabel}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overall" className="mt-0">
          <OverallView onSelectPlatform={(platform: PlatformId) => setTab(platform)} />
        </TabsContent>

        {PLATFORM_ORDER.map((platform) => (
          <TabsContent key={platform} value={platform} className="mt-0">
            <PlatformView platform={platform} />
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
