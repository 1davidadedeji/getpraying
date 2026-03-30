import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetPaths, useGetSavedPrayers, useGetOfficialPrayers } from "@workspace/api-client-react";
import { PostCard } from "@/components/post-card";
import { BookMarked, PlayCircle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Library() {
  const [activeTab, setActiveTab] = useState("library");

  const { data: paths, isLoading: pathsLoading } = useGetPaths();
  const { data: savedPosts, isLoading: savedLoading } = useGetSavedPrayers();
  const { data: officialPrayers, isLoading: officialLoading } = useGetOfficialPrayers();

  return (
    <Layout>
      <div className="flex flex-col min-h-full">
        <header className="px-5 pt-6 pb-4 bg-background">
          <h1 className="text-3xl font-serif font-bold text-primary mb-2">Prayer Library</h1>
          <p className="text-muted-foreground text-sm">Find your sanctuary in words.</p>
        </header>

        <Tabs defaultValue="library" value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
          <div className="px-5">
            <TabsList className="w-full bg-muted/50 p-1 rounded-xl h-12">
              <TabsTrigger value="library" className="flex-1 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">Explore</TabsTrigger>
              <TabsTrigger value="paths" className="flex-1 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">Paths</TabsTrigger>
              <TabsTrigger value="saved" className="flex-1 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">Saved</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 p-5 overflow-y-auto">
            <TabsContent value="library" className="m-0 space-y-8">
              {/* Explore Paths Row */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-lg">Guided Paths</h2>
                  <Button variant="link" size="sm" className="text-primary h-auto p-0" onClick={() => setActiveTab("paths")}>See all</Button>
                </div>
                
                <div className="flex gap-4 overflow-x-auto pb-4 -mx-5 px-5 no-scrollbar">
                  {pathsLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="min-w-[140px] h-32 rounded-2xl bg-muted animate-pulse" />
                    ))
                  ) : paths?.map(path => (
                    <Link key={path.id} href={`/library/paths/${path.id}`}>
                      <div className="min-w-[140px] h-32 rounded-2xl bg-gradient-to-br from-primary/90 to-primary p-4 flex flex-col justify-end relative overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition-all group">
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                        <h3 className="text-primary-foreground font-serif font-medium leading-tight relative z-10">{path.name}</h3>
                        <p className="text-[10px] text-primary-foreground/70 uppercase tracking-widest mt-1 relative z-10">{path.prayerCount} prayers</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>

              {/* Official Guides */}
              <section>
                <h2 className="font-semibold text-lg mb-4">Daily Radiance</h2>
                <div className="space-y-3">
                  {officialLoading ? (
                    <div className="h-24 bg-muted rounded-2xl animate-pulse" />
                  ) : officialPrayers?.slice(0, 2).map(prayer => (
                    <div key={prayer.id} className="bg-card border border-border/50 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                      <div>
                        <span className="text-xs font-medium text-primary/60 uppercase tracking-wider mb-1 block">{prayer.category}</span>
                        <h3 className="font-serif font-medium text-base mb-1">{prayer.title}</h3>
                        <p className="text-xs text-muted-foreground">{prayer.durationMinutes} min • {prayer.audioVoice}</p>
                      </div>
                      <Button size="icon" className="w-10 h-10 rounded-full shadow-sm">
                        <PlayCircle className="w-5 h-5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            </TabsContent>

            <TabsContent value="paths" className="m-0 space-y-4">
              {pathsLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : paths?.map(path => (
                <Link key={path.id} href={`/library/paths/${path.id}`}>
                  <div className="bg-card border border-border/50 p-5 rounded-2xl flex justify-between items-center shadow-sm cursor-pointer hover:border-primary/30 transition-colors">
                    <div className="flex-1 pr-4">
                      <div className="text-[10px] font-semibold text-primary uppercase tracking-widest mb-1">{path.category}</div>
                      <h3 className="font-serif font-semibold text-lg mb-1">{path.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{path.description}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                      {path.prayerCount}
                    </div>
                  </div>
                </Link>
              ))}
            </TabsContent>

            <TabsContent value="saved" className="m-0 space-y-4">
              {savedLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : savedPosts?.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <BookMarked className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-serif font-semibold text-lg mb-1">Your saved scrolls</h3>
                  <p className="text-sm text-muted-foreground max-w-[250px] mx-auto">Prayers you save from the feed will appear here for you to revisit.</p>
                </div>
              ) : (
                savedPosts?.map(post => (
                  <PostCard key={post.id} post={post} />
                ))
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </Layout>
  );
}

// Temporary Button component inline since it wasn't imported
function Button(props: any) {
  return <button {...props} className={`inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${props.className}`}>{props.children}</button>;
}
