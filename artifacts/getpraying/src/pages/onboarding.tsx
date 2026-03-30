import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useSavePreferences, useGetMe } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";

const CATEGORIES = [
  "Anxiety/Stress", "Gratitude", "Relationships", 
  "Mental Health", "Family", "Health", 
  "Work/Career", "Finances", "Sleep", 
  "Growth/Purpose", "Forgiveness"
];

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const savePreferences = useSavePreferences();
  const { data: user, isLoading } = useGetMe();

  useEffect(() => {
    if (user?.onboardingComplete) {
      setLocation("/home");
    }
  }, [user, setLocation]);

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleContinue = () => {
    if (selectedCategories.length === 0) {
      toast({
        title: "Please select at least one",
        description: "Choose categories that resonate with you to personalize your feed.",
      });
      return;
    }

    savePreferences.mutate({ data: { categories: selectedCategories } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/home");
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Failed to save preferences",
          description: "Please try again.",
        });
      }
    });
  };

  if (isLoading || user?.onboardingComplete) return null;

  return (
    <div className="flex flex-col min-h-[100dvh] w-full max-w-[430px] mx-auto bg-background p-6 relative">
      <div className="flex-1 flex flex-col pt-8 pb-24 z-10">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-bold text-primary mb-3">What's on your heart?</h1>
          <p className="text-lg text-muted-foreground">Select topics you'd like to pray about or see in your feed.</p>
        </div>

        <div className="flex flex-wrap gap-3 mb-10">
          {CATEGORIES.map(category => {
            const isSelected = selectedCategories.includes(category);
            return (
              <button
                key={category}
                onClick={() => toggleCategory(category)}
                className={`px-4 py-3 rounded-full text-sm font-medium transition-all duration-200 border flex items-center gap-2 ${
                  isSelected 
                    ? "bg-primary text-primary-foreground border-primary shadow-md transform scale-105" 
                    : "bg-card text-foreground border-border/60 hover:border-primary/30"
                }`}
                data-testid={`category-chip-${category.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
              >
                {category}
                {isSelected && <Check className="w-4 h-4" />}
              </button>
            );
          })}
        </div>

        <div className="mt-auto bg-secondary/30 p-6 rounded-2xl border border-secondary text-center mb-6">
          <p className="font-serif italic text-primary/80 mb-2">"Cast all your anxiety on him because he cares for you."</p>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">1 Peter 5:7</p>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-background via-background to-transparent p-6 z-20 flex justify-center pb-8">
        <div className="w-full max-w-[430px]">
          <Button 
            onClick={handleContinue}
            className="w-full h-14 text-lg font-semibold rounded-xl shadow-lg"
            disabled={savePreferences.isPending}
            data-testid="button-continue"
          >
            {savePreferences.isPending ? "Saving..." : "Continue to Sanctuary"}
          </Button>
        </div>
      </div>
    </div>
  );
}
