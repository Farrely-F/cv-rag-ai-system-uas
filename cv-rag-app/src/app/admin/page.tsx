import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { AdminInterface } from "@/components/admin";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div>
      {/* Session Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Logged in as</span>
            <span className="font-medium text-foreground">
              {session.user.email}
            </span>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button variant="outline" size="sm" type="submit">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </form>
        </div>
      </div>

      {/* Admin Interface */}
      <AdminInterface />
    </div>
  );
}
