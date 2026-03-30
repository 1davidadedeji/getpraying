import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Home, PlusCircle, Library, Bell, User as UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface LayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

export function Layout({ children, showNav = true }: LayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();

  return (
    <div className="flex flex-col min-h-[100dvh] w-full max-w-[430px] mx-auto bg-background shadow-2xl relative overflow-hidden">
      <main className="flex-1 overflow-y-auto w-full pb-20">
        {children}
      </main>

      {showNav && user && (
        <nav className="fixed bottom-0 w-full max-w-[430px] bg-background/80 backdrop-blur-md border-t border-border z-50">
          <div className="flex justify-around items-center p-3">
            <Link href="/home" className="flex flex-col items-center gap-1 p-2 text-muted-foreground hover:text-primary transition-colors data-[active=true]:text-primary" data-active={location === "/home"} data-testid="nav-home">
              <Home className="w-6 h-6" />
              <span className="text-[10px] font-medium">Home</span>
            </Link>
            
            <Link href="/post" className="flex flex-col items-center gap-1 p-2 text-muted-foreground hover:text-primary transition-colors data-[active=true]:text-primary" data-active={location === "/post"} data-testid="nav-post">
              <PlusCircle className="w-6 h-6" />
              <span className="text-[10px] font-medium">Post</span>
            </Link>
            
            <Link href="/library" className="flex flex-col items-center gap-1 p-2 text-muted-foreground hover:text-primary transition-colors data-[active=true]:text-primary" data-active={location.startsWith("/library")} data-testid="nav-library">
              <Library className="w-6 h-6" />
              <span className="text-[10px] font-medium">Library</span>
            </Link>
            
            <Link href="/notifications" className="flex flex-col items-center gap-1 p-2 text-muted-foreground hover:text-primary transition-colors data-[active=true]:text-primary" data-active={location === "/notifications"} data-testid="nav-alerts">
              <Bell className="w-6 h-6" />
              <span className="text-[10px] font-medium">Alerts</span>
            </Link>
            
            <Link href="/profile" className="flex flex-col items-center gap-1 p-2 text-muted-foreground hover:text-primary transition-colors data-[active=true]:text-primary" data-active={location === "/profile"} data-testid="nav-profile">
              <UserIcon className="w-6 h-6" />
              <span className="text-[10px] font-medium">Profile</span>
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
