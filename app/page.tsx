import Link from "next/link";

import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getEnabledProviders } from "@/lib/providers";
import { startSignIn } from "@/lib/server-actions/auth-actions";
import { MeetingPlatform } from "@prisma/client";
import { PlatformLogo } from "@/lib/platform-utils";

export default async function Home() {
  const session = await auth();
  const enabledProviders = getEnabledProviders();
  const defaultProvider = enabledProviders[0];

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-16 px-6 py-20">
      <section className="space-y-6" id="auth">
        <p className="text-sm uppercase tracking-widest text-primary">
          Jump Social AI
        </p>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
          Post-meeting social media content in minutes, not hours.
        </h1>
        <p className="text-lg text-muted-foreground sm:max-w-3xl">
          Connect your Google Calendar, automatically capture meeting insights
          with Recall.ai, and publish polished LinkedIn or Facebook updates with
          a single click.
        </p>
        <div className="flex flex-wrap gap-3">
          {session ? (
            <Button size="lg" asChild>
              <Link href="/dashboard">Go to upcoming meetings</Link>
            </Button>
          ) : defaultProvider ? (
            <form
              action={async () => {
                "use server";
                await startSignIn(defaultProvider.id, "/dashboard");
              }}
            >
              <Button size="lg" type="submit">
                Sign in with {defaultProvider.label}
              </Button>
            </form>
          ) : (
            <Button size="lg" disabled>
              Add OAuth credentials to sign in
            </Button>
          )}
          {session ? (
            <Button variant="outline" size="lg" asChild>
              <Link href="/settings">Open settings</Link>
            </Button>
          ) : (
            <Button variant="outline" size="lg" asChild>
              <a href="#features">Discover features</a>
            </Button>
          )}
        </div>
      </section>

      <section className="space-y-6">
        <div className="space-y-2 text-center">
          <Badge variant="secondary">Supported platforms</Badge>
          <h2 className="text-2xl font-semibold">
            Works with your favorite meeting tools
          </h2>
          <p className="text-muted-foreground">
            The notetaker automatically joins meetings on these platforms
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-12">
          <div className="flex flex-col items-center gap-3">
            <PlatformLogo platform={MeetingPlatform.ZOOM} size={80} />
            <span className="text-base font-medium">Zoom</span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <PlatformLogo platform={MeetingPlatform.GOOGLE_MEET} size={80} />
            <span className="text-base font-medium">Google Meet</span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <PlatformLogo platform={MeetingPlatform.MICROSOFT_TEAMS} size={80} />
            <span className="text-base font-medium">Microsoft Teams</span>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          {
            title: "Calendar aware",
            description:
              "Sync every connected Google account and see upcoming client conversations in one view.",
          },
          {
            title: "Recall powered",
            description:
              "Auto-dispatch bots to Zoom/Meet/Teams so you never miss an insight from the transcript.",
          },
          {
            title: "Social ready",
            description:
              "Generate posts, review drafts, and publish straight to LinkedIn or Facebook.",
          },
        ].map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
        ))}
      </section>

      <section className="grid gap-6 rounded-2xl border bg-card/60 p-8 md:grid-cols-3">
        {[
          {
            value: "2 min",
            label: "from transcript to post-ready draft",
          },
          {
            value: "5x",
            label: "more meetings turning into marketing stories",
          },
          {
            value: "0%",
            label: "chance of missing a call—Recall bots join automatically",
          },
        ].map((stat) => (
          <div key={stat.label}>
            <p className="text-3xl font-semibold tracking-tight">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </section>

      <section id="features" className="space-y-6">
        <div className="space-y-2">
          <Badge variant="secondary">How it works</Badge>
          <h2 className="text-3xl font-semibold">From calendar to social feed</h2>
          <p className="text-muted-foreground">
            Jump Social AI watches your meetings end-to-end and turns them into
            publish-ready content automatically.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              step: "01",
              title: "Sync calendars",
              body: "Connect unlimited Google accounts. Jump merges every client touchpoint into one agenda.",
            },
            {
              step: "02",
              title: "Capture context",
              body: "Recall.ai joins Zoom/Meet/Teams, records the conversation, and delivers transcripts within minutes.",
            },
            {
              step: "03",
              title: "Publish everywhere",
              body: "Automations draft tailored posts per platform, ready for one-click approval—or auto-post for you.",
            },
          ].map((item) => (
            <Card key={item.step}>
              <CardHeader>
                <p className="text-sm font-mono text-muted-foreground">
                  {item.step}
                </p>
                <CardTitle>{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-8 md:grid-cols-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Why advisors choose Jump</CardTitle>
            <CardDescription>
              Everything you need to turn meetings into marketing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              "Smart automations with editable prompts and compliance-friendly templates.",
              "One workspace for Zoom, Teams, Meet—no manual uploads or copying.",
              "Native LinkedIn + Facebook posting with audit-ready history.",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                <p className="text-sm text-muted-foreground">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="h-full bg-muted/50">
          <CardHeader>
            <CardTitle>Advisor spotlight</CardTitle>
            <CardDescription>
              Real workflows from firms using Jump Social AI.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              “We stopped writing recap posts at 10pm. Jump watches every review
              meeting, drafts the email follow-up, and schedules the LinkedIn
              version instantly.”
            </p>
            <p className="font-medium text-foreground">
              — Maya, Principal at Northshore Wealth
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-2xl border bg-card/80 p-8 text-center">
        <Badge variant="secondary">Integrations</Badge>
        <h2 className="mt-4 text-3xl font-semibold">
          Built for modern advisory teams
        </h2>
        <p className="mt-2 text-muted-foreground">
          Works with Google Workspace, Zoom, Microsoft Teams, Recall.ai, LinkedIn,
          Facebook, and your compliance review process.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <span>Google Workspace</span>
          <span>Zoom</span>
          <span>Microsoft Teams</span>
          <span>Recall.ai</span>
          <span>LinkedIn</span>
          <span>Facebook</span>
        </div>
      </section>
    </main>
  );
}
