import { auth, signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const oauthProviders = [
  {
    id: "google",
    label: "Google",
    helper: "Required for login + calendar sync",
    envKeys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    helper: "Needed to publish LinkedIn updates",
    envKeys: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
  },
  {
    id: "facebook",
    label: "Facebook",
    helper: "Post to Facebook Pages or feeds",
    envKeys: ["FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET"],
  },
] as const;

type ProviderId = (typeof oauthProviders)[number]["id"];

const isConfigured = (keys: readonly string[]) =>
  keys.every((key) => Boolean(process.env[key]));

const enabledProviders = oauthProviders.filter((provider) =>
  isConfigured(provider.envKeys),
);

const providerActions: Record<ProviderId, () => Promise<void>> = {
  google: async () => {
    "use server";
    await signIn("google", { redirectTo: "/" });
  },
  linkedin: async () => {
    "use server";
    await signIn("linkedin", { redirectTo: "/" });
  },
  facebook: async () => {
    "use server";
    await signIn("facebook", { redirectTo: "/" });
  },
};

async function handleSignOut() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export default async function Home() {
  const session = await auth();
  const defaultProvider = enabledProviders[0];
  const linkedAccounts = session
    ? await prisma.account.findMany({
        where: { userId: session.user.id },
        select: {
          id: true,
          provider: true,
          providerAccountId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-6 py-16">
      <section className="space-y-6">
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
            <Button size="lg">Go to dashboard</Button>
          ) : defaultProvider ? (
            <form action={providerActions[defaultProvider.id]}>
              <Button size="lg" type="submit">
                Sign in with {defaultProvider.label}
              </Button>
            </form>
          ) : (
            <Button size="lg" disabled>
              Add OAuth credentials to sign in
            </Button>
          )}
          <Button variant="outline" size="lg">
            View roadmap
          </Button>
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
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Coming together in Steps 1-3 of the build plan.
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              {session ? "You’re signed in" : "Authenticate your workspace"}
            </CardTitle>
            <CardDescription>
              {session
                ? "Use the buttons below to link additional social accounts. Linking Google is required for calendar sync."
                : "Choose a provider to create an account. You can link more providers in settings later."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {session && (
              <div className="rounded-md border border-dashed border-border p-4 text-sm">
                <p className="font-medium">Signed in as</p>
                <p className="text-muted-foreground">
                  {session.user.name ?? session.user.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  User ID: {session.user.id}
                </p>
              </div>
            )}

            <div className="space-y-3">
              {enabledProviders.length === 0 && (
                <p className="text-sm text-destructive">
                  No OAuth providers configured. Add credentials to
                  `.env.local`.
                </p>
              )}
              {enabledProviders.map((provider) => (
                <form
                  key={provider.id}
                  action={providerActions[provider.id]}
                  className="space-y-1"
                >
                  <Button
                    variant="outline"
                    type="submit"
                    className="w-full justify-between"
                  >
                    <span>
                      {session ? "Connect" : "Continue with"} {provider.label}
                    </span>
                    <Badge variant="secondary">{provider.helper}</Badge>
                  </Button>
                </form>
              ))}
            </div>

            {session && (
              <form action={handleSignOut}>
                <Button variant="ghost" type="submit" className="w-full">
                  Sign out
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connected accounts</CardTitle>
            <CardDescription>
              Linked providers are stored in Supabase via the Prisma adapter.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {session ? (
              linkedAccounts.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Linked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linkedAccounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="capitalize">
                          {account.provider}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {account.providerAccountId}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {account.createdAt.toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No accounts linked yet. Use the buttons on the left to connect
                  Google, LinkedIn, or Facebook.
                </p>
              )
            ) : (
              <p className="text-sm text-muted-foreground">
                Sign in to view and manage linked providers.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
