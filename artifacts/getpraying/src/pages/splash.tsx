import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { Flame } from "lucide-react";

export default function Splash() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation("/home");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  if (isLoading) return null;

  return (
    <div className="flex flex-col min-h-[100dvh] w-full max-w-[430px] mx-auto bg-background p-6 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-20%] w-[140%] h-[50%] bg-secondary/30 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex-1 flex flex-col justify-center items-center text-center z-10">
        <div className="mb-8">
          <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto shadow-lg mb-6">
            <Flame className="w-10 h-10 text-background" />
          </div>
          <h1 className="text-4xl font-serif font-bold text-primary mb-3">GetPraying</h1>
          <p className="text-lg text-muted-foreground font-medium max-w-[250px] mx-auto">
            A digital sanctuary for your daily walk.
          </p>
        </div>

        <div className="bg-card w-full p-6 rounded-2xl shadow-md border border-border/50 mb-10 text-left">
          <p className="text-sm font-serif italic text-muted-foreground mb-2 text-center">Daily Word</p>
          <p className="text-lg font-medium text-primary text-center mb-4">
            "Be still, and know that I am God."
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <div className="flex -space-x-2">
              <div className="w-6 h-6 rounded-full bg-secondary border-2 border-card" />
              <div className="w-6 h-6 rounded-full bg-primary/20 border-2 border-card" />
              <div className="w-6 h-6 rounded-full bg-muted border-2 border-card" />
            </div>
            <span>128 others are praying with you</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 z-10 pb-8">
        <Link href="/register">
          <Button className="w-full h-14 text-lg font-semibold rounded-xl shadow-md" data-testid="button-signup">
            Start Your Journey
          </Button>
        </Link>
        <Link href="/login">
          <Button variant="outline" className="w-full h-14 text-lg font-medium rounded-xl border-2" data-testid="button-login">
            Sign In
          </Button>
        </Link>
      </div>
    </div>
  );
}
