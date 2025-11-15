import Image from "next/image";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { oauthProviders, providerIsConfigured } from "@/lib/providers";
import { getAccountEmail } from "@/lib/account-utils";
import { startSignIn } from "@/lib/server-actions/auth-actions";
import { AutomationModal } from "@/components/automation-modal";
import { SocialPlatform } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PendingButton } from "@/components/form/pending-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlatformLeadTimeInput } from "@/components/platform-lead-time-input";

async function updateLeadTimeAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const zoomMinutes = Number(formData.get("zoomMinutes") ?? 10);
  const googleMeetMinutes = Number(formData.get("googleMeetMinutes") ?? 0);
  const teamsMinutes = Number(formData.get("teamsMinutes") ?? 10);

  await prisma.setting.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      zoomLeadTimeMinutes: zoomMinutes,
      googleMeetLeadTimeMinutes: googleMeetMinutes,
      teamsLeadTimeMinutes: teamsMinutes,
    },
    update: {
      zoomLeadTimeMinutes: zoomMinutes,
      googleMeetLeadTimeMinutes: googleMeetMinutes,
      teamsLeadTimeMinutes: teamsMinutes,
    },
  });

  revalidatePath("/settings");
}

async function disconnectAccountAction(formData: FormData) {
  "use server";
  const accountId = formData.get("accountId") as string;
  const session = await auth();
  if (!session?.user || !accountId) {
    redirect("/");
  }

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || account.userId !== session.user.id) {
    redirect("/");
  }

  await prisma.account.delete({
    where: { id: accountId },
  });

  revalidatePath("/settings");
}

const DEFAULT_SOCIAL_PROMPT =
  "Draft a concise, compliant social media update (120-150 words) recapping the meeting. Keep the tone warm, forward-looking, and free of sensitive client details.";

function buildPrompt(description?: string | null, example?: string | null) {
  const segments = [];
  if (description) {
    segments.push(description);
  }
  if (example) {
    segments.push(`Example post:\n${example}`);
  }
  segments.push(DEFAULT_SOCIAL_PROMPT);
  return segments.join("\n\n");
}

async function upsertAutomationAction(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const automationId = (formData.get("automationId") as string) || null;
  const name =
    ((formData.get("name") as string) || "Untitled automation").trim();
  const type = ((formData.get("type") as string) || "Generate post").trim();
  const platform = (formData.get("platform") as string)?.toUpperCase();
  const description =
    ((formData.get("description") as string) || "").trim() || null;
  const example =
    ((formData.get("example") as string) || "").trim() || null;

  if (!Object.values(SocialPlatform).includes(platform as SocialPlatform)) {
    throw new Error("Invalid platform selected");
  }

  const prompt = buildPrompt(description, example);

  const data = {
    name,
    type,
    platform: platform as SocialPlatform,
    prompt,
    description,
    example,
  };

  if (automationId) {
    const existing = await prisma.automation.findUnique({
      where: { id: automationId },
      select: { userId: true },
    });
    if (!existing || existing.userId !== session.user.id) {
      redirect("/");
    }
    await prisma.automation.update({
      where: { id: automationId },
      data,
    });
  } else {
    await prisma.automation.create({
      data: {
        ...data,
        userId: session.user.id,
      },
    });
  }

  revalidatePath("/settings");
  revalidatePath("/meetings");
}

async function deleteAutomationAction(formData: FormData) {
  "use server";
  const automationId = formData.get("automationId") as string;
  const session = await auth();
  if (!session?.user || !automationId) {
    redirect("/");
  }

  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
    select: { userId: true },
  });
  if (!automation || automation.userId !== session.user.id) {
    redirect("/");
  }

  await prisma.automation.delete({
    where: { id: automationId },
  });

  revalidatePath("/settings");
  revalidatePath("/meetings");
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const [settings, accounts, automations] = await Promise.all([
    prisma.setting.findUnique({
      where: { userId: session.user.id },
    }),
    prisma.account.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.automation.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const socialProviders = oauthProviders.filter(
    (provider) => provider.id !== "google",
  );
  const googleProvider = oauthProviders.find(
    (provider) => provider.id === "google",
  );
  const googleAccounts = accounts.filter(
    (account) => account.provider === "google",
  );
  const primaryGoogleEmail = session.user.email?.toLowerCase() ?? null;
  const additionalGoogleAccounts = googleAccounts.filter((account) => {
    const email = getAccountEmail(account)?.toLowerCase();
    return !email || email !== primaryGoogleEmail;
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-12">
      <div>
        <p className="text-sm uppercase tracking-tight text-primary">
          Settings
        </p>
        <h1 className="text-3xl font-semibold">Workspace preferences</h1>
        <p className="text-muted-foreground">
          Connect social accounts, manage Recall lead times, and configure
          automations.
        </p>
      </div>

      <Tabs defaultValue="accounts" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="accounts">Connections</TabsTrigger>
          <TabsTrigger value="recall">Recall.ai</TabsTrigger>
          <TabsTrigger value="automations">Automations</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Social providers</CardTitle>
              <CardDescription>
                These OAuth connections power LinkedIn and Facebook publishing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {socialProviders.map((provider) => {
                const connectedAccounts = accounts.filter(
                  (account) => account.provider === provider.id,
                );
                const isConfigured = providerIsConfigured(provider.envKeys);
                return (
                  <div
                    key={provider.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card/50 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Image
                        src={provider.logo}
                        alt={`${provider.label} logo`}
                        width={32}
                        height={32}
                      />
                      <div>
                        <p className="font-medium">{provider.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {provider.helper}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {connectedAccounts.length > 0 ? (
                        connectedAccounts.map((account) => (
                          <div
                            key={account.id}
                            className="flex items-center gap-2 rounded-md border border-dashed px-3 py-1 text-xs"
                          >
                            <span className="font-mono">
                              {account.providerAccountId}
                            </span>
                            <form action={disconnectAccountAction}>
                              <input
                                type="hidden"
                                name="accountId"
                                value={account.id}
                              />
                              <Button variant="ghost" size="sm">
                                Disconnect
                              </Button>
                            </form>
                          </div>
                        ))
                      ) : isConfigured ? (
                        <form
                          action={async () => {
                            "use server";
                            await startSignIn(provider.id, "/settings");
                          }}
                        >
                          <Button variant="outline" size="sm" type="submit">
                            Connect
                          </Button>
                        </form>
                      ) : (
                        <Button variant="outline" size="sm" disabled>
                          Add env vars
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Google calendars</CardTitle>
              <CardDescription>
                Your sign-in Google account stays primary. Connect additional
                Google accounts here for extra calendar coverage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-dashed p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Primary login
                </p>
                <p className="font-medium">
                  {session.user.email ?? "No primary Google email detected"}
                </p>
                <p className="text-xs text-muted-foreground">
                  This account is managed through authentication and cannot be
                  disconnected here.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-wide">
                  Additional calendars
                </p>
                {additionalGoogleAccounts.length ? (
                  additionalGoogleAccounts.map((account) => {
                    const email = getAccountEmail(account);
                    return (
                      <div
                        key={account.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3"
                      >
                        <div>
                          <p className="font-medium">
                            {email ?? "Google account (email unavailable)"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Connected{" "}
                            {account.createdAt.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <form action={disconnectAccountAction}>
                          <input
                            type="hidden"
                            name="accountId"
                            value={account.id}
                          />
                          <Button variant="outline" size="sm">
                            Disconnect
                          </Button>
                        </form>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No additional Google calendars yet.
                  </p>
                )}
              </div>

              {providerIsConfigured(googleProvider?.envKeys ?? []) ? (
                <form
                  action={async () => {
                    "use server";
                    await startSignIn("google", "/settings");
                  }}
                >
                  <Button type="submit">Connect another Google account</Button>
                </form>
              ) : (
                <Button type="button" disabled>
                  Add GOOGLE_CLIENT_ID/SECRET first
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recall">
          <Card>
            <CardHeader>
              <CardTitle>Recall.ai bot lead time</CardTitle>
              <CardDescription>
                How many minutes before a meeting should the bot join? Each platform has different maximum waiting room timeouts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateLeadTimeAction} className="space-y-6">
                <div className="space-y-4">
                  <PlatformLeadTimeInput
                    platform="googleMeet"
                    label="Google Meet"
                    maxValue={5}
                    defaultValue={settings?.googleMeetLeadTimeMinutes ?? 0}
                    platformTimeout={10}
                    name="googleMeetMinutes"
                    id="googleMeetMinutes"
                  />

                  <PlatformLeadTimeInput
                    platform="teams"
                    label="Microsoft Teams"
                    maxValue={25}
                    defaultValue={settings?.teamsLeadTimeMinutes ?? 10}
                    platformTimeout={30}
                    name="teamsMinutes"
                    id="teamsMinutes"
                  />

                  <PlatformLeadTimeInput
                    platform="zoom"
                    label="Zoom"
                    maxValue={1000}
                    defaultValue={settings?.zoomLeadTimeMinutes ?? 10}
                    platformTimeout={Infinity}
                    name="zoomMinutes"
                    id="zoomMinutes"
                  />
                </div>
                <PendingButton className="self-start">Save</PendingButton>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automations">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Social automations</CardTitle>
                  <CardDescription>
                    Jump will use these blueprints the moment a transcript is
                    ready.
                  </CardDescription>
                </div>
                <AutomationModal action={upsertAutomationAction}>
                  <Button>Add automation</Button>
                </AutomationModal>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {automations.length ? (
                <div className="space-y-4">
                  {automations.map((automation) => {
                    const meta = automation as typeof automation & {
                      type?: string;
                      description?: string | null;
                      example?: string | null;
                    };
                    const automationForModal = {
                      ...automation,
                      type: meta.type ?? "Generate post",
                      description: meta.description ?? undefined,
                      example: meta.example ?? undefined,
                    };

                    return (
                      <div
                        key={automation.id}
                        className="rounded-xl border border-border p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">
                              {automationForModal.type}
                            </p>
                            <h4 className="text-lg font-semibold">
                              {automation.name}
                            </h4>
                            <Badge variant="secondary" className="capitalize">
                              {automation.platform.toLowerCase()}
                            </Badge>
                          </div>
                          <AutomationModal
                            automation={automationForModal}
                            action={upsertAutomationAction}
                            deleteAction={deleteAutomationAction}
                          >
                            <Button variant="outline">Edit</Button>
                          </AutomationModal>
                        </div>
                        {automationForModal.description && (
                          <p className="mt-3 text-sm text-muted-foreground">
                            {automationForModal.description}
                          </p>
                        )}
                        <div className="mt-3 text-sm">
                          <p className="font-medium">Prompt</p>
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            {automation.prompt}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No automations yet. Click “Add automation” to get started.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}

