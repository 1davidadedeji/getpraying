import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useGetAdminUsers, useBanUser, useUnbanUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetAdminUsersQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  if (!currentUser?.isAdmin) {
    setLocation("/home");
    return null;
  }

  const { data, isLoading } = useGetAdminUsers({});
  const banMutation = useBanUser();
  const unbanMutation = useUnbanUser();

  const handleBanToggle = (userId: number, isCurrentlyBanned: boolean) => {
    const mutation = isCurrentlyBanned ? unbanMutation : banMutation;
    
    mutation.mutate({ userId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey({}) });
        toast({ title: isCurrentlyBanned ? "User unbanned" : "User banned" });
      }
    });
  };

  return (
    <Layout showNav={false}>
      <div className="flex flex-col min-h-full bg-slate-50 dark:bg-slate-900 pb-10">
        <header className="px-4 py-4 bg-card border-b border-border flex items-center gap-3 sticky top-0 z-10">
          <Link href="/admin">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold text-lg">Manage Users</h1>
          </div>
        </header>

        <div className="p-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            data?.users.map(user => (
              <div key={user.id} className={`bg-card border p-4 rounded-xl flex items-center justify-between shadow-sm ${user.isBanned ? 'border-destructive/30 bg-destructive/5' : 'border-border/60'}`}>
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10 border border-muted">
                    <AvatarImage src={user.avatarUrl || undefined} />
                    <AvatarFallback className="text-xs">{user.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-sm leading-none">{user.username}</h3>
                      {user.isAdmin && <ShieldCheck className="w-3 h-3 text-primary" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      {user.prayersShared} posts • {user.prayedFor} prayed
                    </p>
                  </div>
                </div>

                {!user.isAdmin && (
                  <Button 
                    variant={user.isBanned ? "outline" : "ghost"} 
                    size="sm" 
                    className={`h-8 px-3 rounded-full text-xs font-medium ${user.isBanned ? 'border-destructive text-destructive' : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'}`}
                    onClick={() => handleBanToggle(user.id, user.isBanned)}
                  >
                    {user.isBanned ? "Unban" : "Ban"}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
