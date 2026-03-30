import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useGetPosts, useGetFeedStats } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { PostCard } from "@/components/post-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Flame, Loader2 } from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  
  const { data: stats, isLoading: statsLoading } = useGetFeedStats();
  
  const { data: postsPage, isLoading: postsLoading } = useGetPosts({
    limit: 20
  });

  return (
    <Layout>
      <div className="flex flex-col min-h-full">
        <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border/50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-sm">
              <Flame className="w-4 h-4 text-background" />
            </div>
            <span className="font-serif font-bold text-lg text-primary">Sanctuary</span>
          </div>
          
          <Link href="/profile">
            <Avatar className="w-8 h-8 border border-muted cursor-pointer" data-testid="avatar-home-profile">
              <AvatarImage src={user?.avatarUrl || undefined} />
              <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-medium">
                {user?.username?.substring(0, 2).toUpperCase() || "ME"}
              </AvatarFallback>
            </Avatar>
          </Link>
        </header>

        <div className="p-4 space-y-6">
          {/* Reflection Card */}
          <div className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-2xl p-6 shadow-md relative overflow-hidden">
            <div className="absolute right-[-10%] top-[-20%] w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <p className="text-xs uppercase tracking-widest font-semibold text-primary-foreground/70 mb-3">Morning Reflection</p>
            {statsLoading ? (
              <div className="h-16 flex items-center"><Loader2 className="w-5 h-5 animate-spin text-primary-foreground/50" /></div>
            ) : (
              <p className="font-serif text-lg leading-snug italic relative z-10">
                "{stats?.dailyReflection || "Let the morning bring me word of your unfailing love, for I have put my trust in you."}"
              </p>
            )}
          </div>

          {/* Compose Box Trigger */}
          <Link href="/post">
            <div className="bg-card border border-border/60 rounded-full p-1 pl-4 flex items-center shadow-sm cursor-text hover:border-primary/30 transition-colors group" data-testid="compose-trigger">
              <span className="text-muted-foreground text-sm flex-1">What's on your heart, {user?.displayName || user?.username}?</span>
              <Button size="sm" className="rounded-full px-5 shadow-sm group-hover:bg-primary/90">
                Share
              </Button>
            </div>
          </Link>

          {/* Stats quick row */}
          {!statsLoading && stats && (
            <div className="flex gap-4 px-2 overflow-x-auto no-scrollbar pb-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                <Flame className="w-3.5 h-3.5 fill-primary/20 text-primary" />
                <span className="font-semibold text-foreground">{stats.prayersToday}</span> prayers today
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="font-semibold text-foreground">{stats.activePrayers}</span> active requests
              </div>
            </div>
          )}

          <div className="w-full h-[1px] bg-border/40 my-2" />

          {/* Feed */}
          <div className="space-y-4 pb-4">
            {postsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-card p-5 rounded-2xl border border-border/40 h-40 animate-pulse flex flex-col justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted" />
                    <div className="space-y-2">
                      <div className="h-3 w-24 bg-muted rounded" />
                      <div className="h-2 w-16 bg-muted rounded" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-muted rounded" />
                    <div className="h-3 w-4/5 bg-muted rounded" />
                  </div>
                </div>
              ))
            ) : postsPage?.posts.length === 0 ? (
              <div className="text-center py-10 px-4">
                <div className="w-16 h-16 bg-secondary/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Flame className="w-8 h-8 text-primary/40" />
                </div>
                <h3 className="font-serif font-semibold text-lg text-primary mb-1">A quiet sanctuary</h3>
                <p className="text-sm text-muted-foreground">Be the first to share a prayer with the community today.</p>
              </div>
            ) : (
              postsPage?.posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
