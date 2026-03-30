import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Flame, Bookmark, Share, MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePrayForPost, useSavePost, useUnsavePost, useDeletePost } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetPostsQueryKey, getGetUserPostsQueryKey, getGetSavedPrayersQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Post } from "@workspace/api-client-react/src/generated/api.schemas";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isPraying, setIsPraying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const prayMutation = usePrayForPost();
  const saveMutation = useSavePost();
  const unsaveMutation = useUnsavePost();
  const deleteMutation = useDeletePost();

  const handlePray = () => {
    if (isPraying) return;
    setIsPraying(true);
    prayMutation.mutate({ postId: post.id }, {
      onSuccess: () => {
        // Optimistically update could be done here, but invalidating is easier for now
        queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetUserPostsQueryKey(post.authorUsername || "") });
        setIsPraying(false);
      },
      onError: () => {
        setIsPraying(false);
      }
    });
  };

  const handleSaveToggle = () => {
    if (isSaving) return;
    setIsSaving(true);
    
    if (post.isSaved) {
      unsaveMutation.mutate({ postId: post.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetSavedPrayersQueryKey() });
          setIsSaving(false);
          toast({ title: "Removed from saved scrolls" });
        },
        onError: () => setIsSaving(false)
      });
    } else {
      saveMutation.mutate({ postId: post.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetSavedPrayersQueryKey() });
          setIsSaving(false);
          toast({ title: "Saved to your sanctuary" });
        },
        onError: () => setIsSaving(false)
      });
    }
  };

  const handleDelete = () => {
    deleteMutation.mutate({ postId: post.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetUserPostsQueryKey(user?.username || "") });
        toast({ title: "Prayer removed" });
      }
    });
  };

  const authorName = post.isAnonymous ? "Anonymous" : (post.authorDisplayName || post.authorUsername || "Unknown");
  const authorInitials = authorName.substring(0, 2).toUpperCase();

  return (
    <div className="bg-card p-5 rounded-2xl shadow-sm border border-border/40 mb-4 transition-all hover:shadow-md">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 border border-muted">
            <AvatarImage src={post.isAnonymous ? undefined : (post.authorAvatarUrl || undefined)} />
            <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-medium">
              {authorInitials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-primary text-sm">{authorName}</h3>
            <p className="text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {post.category && (
            <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 font-medium tracking-wider uppercase border-primary/20 text-primary/70 bg-primary/5">
              {post.category}
            </Badge>
          )}
          
          {(user?.id === post.authorId || user?.isAdmin) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
                  <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                  Delete Prayer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-foreground leading-relaxed text-sm whitespace-pre-wrap">{post.content}</p>
        
        {post.mediaUrl && post.mediaType === 'image' && (
          <div className="mt-3 rounded-xl overflow-hidden border border-border/50">
            <img src={post.mediaUrl} alt="Prayer attachment" className="w-full h-auto object-cover max-h-60" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border/30">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handlePray}
          disabled={isPraying}
          className={`gap-1.5 px-2 rounded-full transition-all ${post.hasPrayed ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary hover:bg-primary/5'}`}
          data-testid={`button-pray-${post.id}`}
        >
          <Flame className={`w-5 h-5 ${post.hasPrayed ? 'fill-primary' : ''} ${isPraying ? 'animate-pulse' : ''}`} />
          <span className="text-xs font-semibold">{post.prayCount}</span>
        </Button>

        <div className="flex gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleSaveToggle}
            disabled={isSaving}
            className={`w-9 h-9 rounded-full ${post.isSaved ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
            data-testid={`button-save-${post.id}`}
          >
            <Bookmark className={`w-4 h-4 ${post.isSaved ? 'fill-primary' : ''}`} />
          </Button>
          
          <Button variant="ghost" size="icon" className="w-9 h-9 rounded-full text-muted-foreground hover:text-primary">
            <Share className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
