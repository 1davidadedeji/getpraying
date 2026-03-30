import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useGetUserProfile, useGetUserPosts, useLogout } from "@workspace/api-client-react";
import { PostCard } from "@/components/post-card";
import { Settings, LogOut, Loader2, ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Profile() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const logoutMutation = useLogout();
  
  const { data: profile, isLoading: profileLoading } = useGetUserProfile(user?.username || "", {
    query: { enabled: !!user?.username }
  });
  
  const { data: userPosts, isLoading: postsLoading } = useGetUserPosts(user?.username || "", {}, {
    query: { enabled: !!user?.username }
  });

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/");
      }
    });
  };

  if (!user) return null;

  return (
    <Layout>
      <div className="flex flex-col min-h-full">
        {/* Header/Cover */}
        <div className="h-32 bg-primary w-full relative">
          <div className="absolute top-4 right-4 flex gap-2">
            {user.isAdmin && (
              <Link href="/admin">
                <Button variant="secondary" size="icon" className="w-8 h-8 rounded-full bg-white/20 text-white hover:bg-white/30 border-none">
                  <ShieldCheck className="w-4 h-4" />
                </Button>
              </Link>
            )}
            <Button 
              variant="secondary" 
              size="icon" 
              onClick={handleLogout}
              className="w-8 h-8 rounded-full bg-white/20 text-white hover:bg-white/30 border-none"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Profile Info */}
        <div className="px-5 pb-6 relative">
          <Avatar className="w-20 h-20 border-4 border-background absolute -top-10 left-5 shadow-sm">
            <AvatarImage src={profile?.avatarUrl || undefined} />
            <AvatarFallback className="bg-secondary text-secondary-foreground text-xl font-bold">
              {profile?.username?.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex justify-end pt-3 mb-2">
            <Button variant="outline" size="sm" className="rounded-full h-8 px-4 text-xs font-medium">Edit Profile</Button>
          </div>
          
          <div className="mt-2">
            <h1 className="text-xl font-serif font-bold text-foreground">{profile?.displayName || profile?.username}</h1>
            <p className="text-sm text-muted-foreground">@{profile?.username}</p>
            
            {profile?.bio && (
              <p className="text-sm mt-3 text-foreground/90 leading-relaxed max-w-[90%]">
                {profile.bio}
              </p>
            )}
          </div>
          
          {/* Stats Row */}
          <div className="flex gap-6 mt-6 pt-6 border-t border-border/50">
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-none">{profile?.prayersShared || 0}</span>
              <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Shared</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-none">{profile?.prayedFor || 0}</span>
              <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Prayed For</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-none">{profile?.savedScrolls || 0}</span>
              <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Saved</span>
            </div>
          </div>
        </div>

        <div className="w-full h-2 bg-muted/30" />

        {/* Content Tabs */}
        <Tabs defaultValue="prayers" className="flex-1 flex flex-col">
          <TabsList className="w-full justify-start rounded-none h-12 bg-transparent border-b border-border/40 px-5 gap-6">
            <TabsTrigger 
              value="prayers" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-3 data-[state=active]:font-semibold"
            >
              My Prayers
            </TabsTrigger>
            <TabsTrigger 
              value="categories" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-3 data-[state=active]:font-semibold"
            >
              Categories
            </TabsTrigger>
          </TabsList>

          <div className="p-4 flex-1 bg-muted/10">
            <TabsContent value="prayers" className="m-0 space-y-4">
              {postsLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : userPosts?.posts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground text-sm">You haven't shared any prayers yet.</p>
                  <Link href="/post">
                    <Button variant="link" className="text-primary mt-2">Share your first prayer</Button>
                  </Link>
                </div>
              ) : (
                userPosts?.posts.map(post => (
                  <PostCard key={post.id} post={post} />
                ))
              )}
            </TabsContent>
            
            <TabsContent value="categories" className="m-0">
              <h3 className="text-sm font-semibold mb-3">Your Focus Areas</h3>
              <div className="flex flex-wrap gap-2">
                {user.preferredCategories?.map(cat => (
                  <div key={cat} className="px-3 py-1.5 bg-card border border-border rounded-full text-xs font-medium">
                    {cat}
                  </div>
                ))}
                <Button variant="outline" size="sm" className="rounded-full h-7 px-3 text-xs border-dashed">
                  + Add more
                </Button>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </Layout>
  );
}
