import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useCreatePost } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { X, Send, EyeOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetPostsQueryKey, getGetUserPostsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";

const CATEGORIES = ["Gratitude", "Anxiety", "Healing", "Guidance", "Family", "Health"];

const formSchema = z.object({
  content: z.string().min(1, { message: "Prayer cannot be empty" }).max(1000),
  category: z.string().optional(),
  isAnonymous: z.boolean().default(false),
});

export default function Post() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const createMutation = useCreatePost();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: "",
      category: "",
      isAnonymous: false,
    },
  });

  const category = form.watch("category");

  function onSubmit(values: z.infer<typeof formSchema>) {
    createMutation.mutate({ data: {
      content: values.content,
      category: values.category || null,
      isAnonymous: values.isAnonymous
    } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetUserPostsQueryKey(user?.username || "") });
        toast({
          title: "Prayer Shared",
          description: "Your prayer has been added to the sanctuary.",
        });
        setLocation("/home");
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Failed to share",
          description: "Please try again later.",
        });
      }
    });
  }

  return (
    <div className="flex flex-col min-h-[100dvh] w-full max-w-[430px] mx-auto bg-background relative">
      <header className="px-4 py-4 flex items-center justify-between border-b border-border/40">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/home")} className="rounded-full" data-testid="button-close-post">
          <X className="w-5 h-5" />
        </Button>
        <span className="font-medium text-sm">Write a Prayer</span>
        <Button 
          onClick={form.handleSubmit(onSubmit)} 
          disabled={createMutation.isPending || !form.watch("content").trim()}
          size="sm" 
          className="rounded-full px-4"
          data-testid="button-share-prayer"
        >
          {createMutation.isPending ? "Sharing..." : "Share"}
        </Button>
      </header>

      <div className="flex-1 p-4 flex flex-col">
        <Textarea
          placeholder="What's on your heart?"
          className="flex-1 resize-none border-none shadow-none focus-visible:ring-0 p-0 text-lg bg-transparent placeholder:text-muted-foreground/60"
          {...form.register("content")}
          data-testid="textarea-content"
        />

        <div className="mt-6 space-y-6">
          <div>
            <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3 block">Add a Category (Optional)</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => form.setValue("category", category === cat ? "" : cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                    category === cat 
                      ? "bg-primary text-primary-foreground border-primary" 
                      : "bg-card text-foreground border-border hover:border-primary/50"
                  }`}
                  data-testid={`chip-category-${cat}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border/60 rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center">
                <EyeOff className="w-5 h-5 text-primary/70" />
              </div>
              <div>
                <Label htmlFor="anonymous-mode" className="font-medium text-primary">Post Anonymously</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">Your name and avatar will be hidden.</p>
              </div>
            </div>
            <Switch 
              id="anonymous-mode" 
              checked={form.watch("isAnonymous")}
              onCheckedChange={(checked) => form.setValue("isAnonymous", checked)}
              data-testid="switch-anonymous"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
