import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  // Store owners and store admins both manage company settings & staff.
  const isAdmin = user?.role === "admin" || user?.role === "owner";
  if (!isAdmin) {
    return (
      <Card className="mx-auto mt-8 max-w-md border-dashed">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="size-6" />
          </div>
          <p className="font-semibold">Akses i kufizuar</p>
          <p className="text-sm text-muted-foreground">
            Kjo faqe është e disponueshme vetëm për administratorët.
          </p>
        </CardContent>
      </Card>
    );
  }

  return children;
}
