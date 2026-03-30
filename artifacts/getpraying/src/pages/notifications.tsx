import { Layout } from "@/components/layout";
import { useGetNotifications, useMarkAllNotificationsRead } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { Flame, Bell, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetNotificationsQueryKey } from "@workspace/api-client-react";

export default function Notifications() {
  const queryClient = useQueryClient();
  const { data: notifications, isLoading } = useGetNotifications();
  const markReadMutation = useMarkAllNotificationsRead();

  const handleMarkAllRead = () => {
    markReadMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
      }
    });
  };

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  return (
    <Layout>
      <div className="flex flex-col min-h-full">
        <header className="px-5 pt-6 pb-4 bg-background sticky top-0 z-10 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-serif font-bold text-primary mb-1">Alerts</h1>
              <p className="text-muted-foreground text-xs">Stay connected with your community.</p>
            </div>
            {unreadCount > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleMarkAllRead}
                disabled={markReadMutation.isPending}
                className="text-xs h-8 rounded-full"
              >
                Mark all read
              </Button>
            )}
          </div>
        </header>

        <div className="p-5 space-y-6">
          {/* Static Reminder Card */}
          <div className="bg-gradient-to-r from-secondary to-secondary/60 border border-secondary rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary/60 uppercase tracking-wider mb-1">
                <Bell className="w-3.5 h-3.5" /> Reminder
              </div>
              <h3 className="font-serif text-lg font-medium text-primary">Time to pray</h3>
              <p className="text-sm text-primary/80 mt-1">Take 5 minutes for your evening reflection.</p>
            </div>
            <Button size="sm" className="rounded-full shrink-0 shadow-sm">Begin</Button>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-4">Recent Activity</h2>
            
            <div className="space-y-1">
              {isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : notifications?.length === 0 ? (
                <div className="text-center py-12 px-4 border border-dashed border-border rounded-2xl">
                  <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-sm text-muted-foreground">No new alerts. Your sanctuary is quiet.</p>
                </div>
              ) : (
                notifications?.map(notification => (
                  <div 
                    key={notification.id} 
                    className={`flex gap-4 p-4 rounded-xl transition-colors ${!notification.isRead ? 'bg-primary/5' : 'bg-transparent hover:bg-muted/30'}`}
                  >
                    <div className="relative shrink-0">
                      {notification.type === 'prayer' ? (
                        <Avatar className="w-10 h-10 border border-border">
                          <AvatarImage src={notification.actorAvatarUrl || undefined} />
                          <AvatarFallback className="bg-muted text-xs">{notification.actorUsername?.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      ) : notification.type === 'category_new' ? (
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                          <Sparkles className="w-5 h-5 text-primary" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <Bell className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      
                      {!notification.isRead && (
                        <div className="absolute top-0 right-0 w-3 h-3 bg-destructive rounded-full border-2 border-background" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-sm text-foreground leading-snug">
                        {notification.type === 'prayer' && <span className="font-semibold">{notification.actorUsername} </span>}
                        {notification.message}
                      </p>
                      
                      {notification.postPreview && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1 border-l-2 border-primary/30 pl-2 italic">
                          "{notification.postPreview}"
                        </p>
                      )}
                      
                      <p className="text-[10px] text-muted-foreground mt-2 font-medium">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
