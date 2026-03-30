import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetPendingPosts, useGetModeratedPosts, useApprovePost, useDeclinePost, useGetAdminStats } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ShieldCheck, Check, X, AlertTriangle, Users, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { getGetPendingPostsQueryKey, getGetModeratedPostsQueryKey, getGetAdminStatsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export default function Admin() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  if (!user?.isAdmin) {
    setLocation("/home");
    return null;
  }

  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: pendingData, isLoading: pendingLoading } = useGetPendingPosts();
  const { data: moderatedData, isLoading: moderatedLoading } = useGetModeratedPosts();

  const approveMutation = useApprovePost();
  const declineMutation = useDeclinePost();

  const handleApprove = (postId: number) => {
    approveMutation.mutate({ postId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPendingPostsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetModeratedPostsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
        toast({ title: "Post approved" });
      }
    });
  };

  const handleDecline = (postId: number) => {
    declineMutation.mutate({ postId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPendingPostsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetModeratedPostsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
        toast({ title: "Post declined" });
      }
    });
  };

  return (
    <Layout showNav={false}>
      <div className="flex flex-col min-h-full bg-slate-50 dark:bg-slate-900">
        <header className="px-5 pt-6 pb-4 bg-primary text-primary-foreground flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary-foreground/80 mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Moderation Sanctuary</span>
            </div>
            <h1 className="text-2xl font-serif font-bold">Admin Dashboard</h1>
          </div>
          <Link href="/home">
            <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10 rounded-full text-xs">
              Exit Admin
            </Button>
          </Link>
        </header>

        {/* Quick Stats */}
        <div className="bg-primary pb-6 px-5 rounded-b-3xl">
          <div className="flex gap-3 overflow-x-auto no-scrollbar">
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl p-3 min-w-[120px]">
              <div className="text-primary-foreground/60 text-xs font-medium mb-1">Pending</div>
              <div className="text-2xl font-bold text-white">{stats?.pendingPosts || 0}</div>
            </div>
            <Link href="/admin/users" className="block min-w-[120px]">
              <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl p-3 h-full flex flex-col justify-between hover:bg-white/20 transition-colors">
                <div className="flex items-center gap-1.5 text-primary-foreground/60 text-xs font-medium mb-1">
                  <Users className="w-3.5 h-3.5" /> Users
                </div>
                <div className="text-2xl font-bold text-white">{stats?.totalUsers || 0}</div>
              </div>
            </Link>
          </div>
        </div>

        <div className="flex-1 -mt-4 px-3 pb-8">
          <Tabs defaultValue="flagged" className="w-full bg-card rounded-2xl shadow-sm border border-border/50 p-2 min-h-[60vh] flex flex-col">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="flagged" className="rounded-lg">Flagged</TabsTrigger>
              <TabsTrigger value="moderated" className="rounded-lg">History</TabsTrigger>
            </TabsList>

            <TabsContent value="flagged" className="flex-1 m-0 space-y-4 px-2">
              {pendingLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : pendingData?.posts.length === 0 ? (
                <div className="text-center py-16">
                  <ShieldCheck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">All caught up!</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">No pending posts to moderate.</p>
                </div>
              ) : (
                pendingData?.posts.map(post => (
                  <div key={post.id} className="border border-border/60 rounded-xl p-4 bg-background">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-[10px]">{post.authorUsername?.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-semibold">{post.authorUsername}</div>
                          <div className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(post.createdAt))}</div>
                        </div>
                      </div>
                      {post.flagReason && (
                        <Badge variant="destructive" className="text-[10px] uppercase tracking-wider flex gap-1 items-center px-1.5 h-5">
                          <AlertTriangle className="w-3 h-3" /> {post.flagReason}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="bg-muted/30 p-3 rounded-lg text-sm border-l-2 border-muted-foreground/30 mb-4">
                      {post.content}
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="default" 
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleApprove(post.id)}
                      >
                        <Check className="w-4 h-4 mr-1" /> Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        className="flex-1"
                        onClick={() => handleDecline(post.id)}
                      >
                        <X className="w-4 h-4 mr-1" /> Decline
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="moderated" className="flex-1 m-0 space-y-3 px-2">
              {moderatedLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : (
                moderatedData?.posts.map(post => (
                  <div key={post.id} className="border border-border/40 rounded-xl p-3 flex flex-col gap-2 bg-background opacity-75">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-muted-foreground">{post.authorUsername}</span>
                      <Badge variant={post.status === 'approved' ? 'default' : 'destructive'} className="text-[9px] h-4">
                        {post.status}
                      </Badge>
                    </div>
                    <p className="text-xs line-clamp-2">{post.content}</p>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
