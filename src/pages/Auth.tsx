import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import logo from "@/assets/logo.svg";
import { Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";
import { Suspense, useState } from "react";
import { useMutation } from "convex/react";
import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router";
import { toast } from "sonner";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const claimFirstAdmin = useMutation(api.staff.claimFirstAdmin);
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already signed in
  if (!authLoading && isAuthenticated && typeof window !== "undefined") {
    navigate(redirect);
  }

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("password", {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        flow: "signIn",
      });
      navigate(redirect);
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes("Invalid")
          ? "Email ose fjalëkalim i pasaktë."
          : "Kyçja dështoi. Provoni përsëri.",
      );
      setIsLoading(false);
    }
  };

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      const name = String(formData.get("name") ?? "");
      const email = String(formData.get("email") ?? "");
      const password = String(formData.get("password") ?? "");
      await signIn("password", {
        email,
        password,
        name,
        flow: "signUp",
      });
      // The very first registered user becomes the admin
      try {
        await claimFirstAdmin({});
      } catch {
        // non-fatal
      }
      navigate(redirect);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg.includes("exists") || msg.includes("duplicate")
          ? "Ky email është i regjistruar tashmë. Provoni të kyçeni."
          : msg.includes("8")
            ? "Fjalëkalimi duhet të ketë të paktën 8 karaktere."
            : "Regjistrimi dështoi. Provoni përsëri.",
      );
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("google");
      // OAuth redirects the page; nothing else to do
    } catch {
      setError(
        "Kyçja me Google nuk është e konfiguruar. Përdorni email & fjalëkalim.",
      );
      setIsLoading(false);
    }
  };

  const passwordFields = (keyPrefix: string, withName = false) => (
    <>
      {withName && (
        <div className="space-y-1.5">
          <Label htmlFor={`${keyPrefix}-name`}>Emri</Label>
          <div className="relative">
            <User className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              id={`${keyPrefix}-name`}
              name="name"
              placeholder="Emri juaj"
              className="pl-9"
              disabled={isLoading}
            />
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor={`${keyPrefix}-email`}>Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            id={`${keyPrefix}-email`}
            name="email"
            type="email"
            placeholder="emri@shembull.com"
            className="pl-9"
            disabled={isLoading}
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${keyPrefix}-password`}>Fjalëkalimi</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            id={`${keyPrefix}-password`}
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            className="pl-9 pr-10"
            disabled={isLoading}
            required
            minLength={8}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <Link to="/">
              <img
                src={logo}
                alt="OrderSnap AI"
                width={56}
                height={56}
                className="mb-4 size-14 rounded-xl"
              />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">OrderSnap AI</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sistemi i Menaxhimit të Porosive dhe Automatizimit me AI
            </p>
          </div>

          <Card className="border-border/60 shadow-xl shadow-black/5">
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Kyçuni</TabsTrigger>
                <TabsTrigger value="register">Regjistrohu</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Mirë se vini përsëri</CardTitle>
                  <CardDescription>
                    Kyçuni me email dhe fjalëkalimin tuaj.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    {passwordFields("login")}
                    {error && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : null}
                      Kyçuni
                    </Button>
                  </form>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        ose
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                  >
                    <GoogleIcon />
                    Kyçuni me Google
                  </Button>
                </CardContent>
              </TabsContent>

              <TabsContent value="register">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Krijo llogari</CardTitle>
                  <CardDescription>
                    Regjistrohu për të filluar menaxhimin e porosive me AI.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    {passwordFields("register", true)}
                    {error && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : null}
                      Regjistrohu
                    </Button>
                  </form>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        ose
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                  >
                    <GoogleIcon />
                    Regjistrohu me Google
                  </Button>
                </CardContent>
              </TabsContent>
            </Tabs>
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            duke vazhduar ju pranoni kushtet e përdorimit të OrderSnap AI.
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.96 10.96 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
