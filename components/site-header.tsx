import Link from "next/link";

import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { getEnabledProviders } from "@/lib/providers";
import { LogoWordmark } from "@/components/logo-wordmark";
import { startSignIn, startSignOut } from "@/lib/server-actions/auth-actions";

export async function SiteHeader() {
  const session = await auth();
  const enabledProviders = getEnabledProviders();
  const defaultProvider = enabledProviders[0];

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="/" className="flex items-center gap-3 text-foreground">
          <LogoWordmark className="h-6 w-auto" />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">
              Jump Social AI
            </span>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Advisor workspace
            </span>
          </div>
        </a>
        {session ? (
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="/dashboard" className="hover:text-foreground">
              Upcoming meetings
            </a>
            <a href="/meetings" className="hover:text-foreground">
              Past meetings
            </a>
          </nav>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-3">
          {session ? (
            <>
              <div className="text-right">
                <p className="text-sm font-medium">
                  {session.user.name ?? "Advisor"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {session.user.email}
                </p>
              </div>
              <Button variant="outline" asChild className="hidden md:inline-flex">
                <Link href="/settings">Settings</Link>
              </Button>
              <form
                action={async () => {
                  "use server";
                  await startSignOut("/");
                }}
              >
                <Button variant="ghost" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            </>
          ) : defaultProvider ? (
            <form
              action={async () => {
                "use server";
                await startSignIn(defaultProvider.id, "/dashboard");
              }}
            >
              <Button size="sm" type="submit">
                Sign in
              </Button>
            </form>
          ) : (
            <Button size="sm" asChild>
              <Link href="/#auth">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

