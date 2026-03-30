import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useGetPath } from "@workspace/api-client-react";
import { PostCard } from "@/components/post-card";
import { ArrowLeft, PlayCircle, Loader2, Clock } from "lucide-react";

export default function PathDetail() {
  const [match, params] = useRoute("/library/paths/:pathId");
  const pathId = match ? parseInt(params.pathId, 10) : 0;
  
  const { data: pathDetail, isLoading } = useGetPath(pathId, {
    query: {
      enabled: !!pathId
    }
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!pathDetail) {
    return (
      <Layout>
        <div className="p-6 text-center">Path not found</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col min-h-full pb-6">
        <div className="bg-primary text-primary-foreground pt-6 pb-10 px-5 rounded-b-[40px] relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          
          <Link href="/library">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/10 rounded-full mb-6 relative z-10" data-testid="btn-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          
          <div className="relative z-10">
            <div className="inline-block px-3 py-1 bg-white/10 rounded-full text-[10px] font-medium tracking-widest uppercase mb-3 backdrop-blur-sm">
              {pathDetail.category}
            </div>
            <h1 className="text-3xl font-serif font-bold mb-2">{pathDetail.name}</h1>
            <p className="text-primary-foreground/80 leading-relaxed text-sm max-w-[90%]">
              {pathDetail.description}
            </p>
          </div>
        </div>

        <div className="px-5 mt-8 space-y-8">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg text-primary">Guided Sessions</h2>
              <span className="text-xs text-muted-foreground font-medium">{pathDetail.officialPrayers.length} available</span>
            </div>
            
            <div className="space-y-3">
              {pathDetail.officialPrayers.map((prayer, idx) => (
                <div key={prayer.id} className="bg-card border border-border/60 rounded-2xl p-4 flex gap-4 shadow-sm hover:border-primary/40 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center text-primary font-serif font-bold shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-serif font-medium text-base mb-1 truncate">{prayer.title}</h3>
                    {prayer.subtitle && <p className="text-xs text-muted-foreground truncate mb-2">{prayer.subtitle}</p>}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-medium">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {prayer.durationMinutes}m</span>
                      {prayer.audioVoice && <span>Voice: {prayer.audioVoice}</span>}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="w-10 h-10 rounded-full text-primary hover:bg-primary/10 shrink-0 self-center">
                    <PlayCircle className="w-6 h-6" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {pathDetail.savedPosts && pathDetail.savedPosts.length > 0 && (
            <section>
              <h2 className="font-semibold text-lg text-primary mb-4">Community Insights</h2>
              <div className="space-y-4">
                {pathDetail.savedPosts.map(post => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </Layout>
  );
}
