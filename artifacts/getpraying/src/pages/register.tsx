import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useRegister } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Flame } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  username: z.string().min(3, { message: "Username must be at least 3 characters." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  displayName: z.string().optional(),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const registerMutation = useRegister();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      username: "",
      password: "",
      displayName: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    registerMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({
          title: "Account created",
          description: "Welcome to GetPraying. Let's personalize your experience.",
        });
        setLocation("/onboarding");
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Registration failed",
          description: error.error || "An error occurred. Please try again.",
        });
      }
    });
  }

  return (
    <div className="flex flex-col min-h-[100dvh] w-full max-w-[430px] mx-auto bg-background p-6 relative overflow-y-auto">
      <div className="absolute top-[-10%] right-[-20%] w-[100%] h-[40%] bg-secondary/30 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex items-center mb-6 z-10 pt-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted" data-testid="button-back">
            <ArrowLeft className="w-5 h-5 text-primary" />
          </Button>
        </Link>
      </div>

      <div className="flex-1 flex flex-col z-10 pb-8">
        <div className="mb-8">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-sm mb-4">
            <Flame className="w-6 h-6 text-background" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-primary mb-2">Create Account</h1>
          <p className="text-muted-foreground">Join our community and start your journey.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-primary font-medium">Email</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter your email" 
                      className="h-12 bg-card border-border/50 focus-visible:ring-primary rounded-xl" 
                      data-testid="input-email"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-primary font-medium">Username</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Choose a username" 
                      className="h-12 bg-card border-border/50 focus-visible:ring-primary rounded-xl" 
                      data-testid="input-username"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-primary font-medium">Display Name (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="How should we call you?" 
                      className="h-12 bg-card border-border/50 focus-visible:ring-primary rounded-xl" 
                      data-testid="input-display-name"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-primary font-medium">Password</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder="Create a password" 
                      className="h-12 bg-card border-border/50 focus-visible:ring-primary rounded-xl" 
                      data-testid="input-password"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className="w-full h-14 text-lg font-semibold rounded-xl shadow-md mt-6" 
              disabled={registerMutation.isPending}
              data-testid="button-submit-register"
            >
              {registerMutation.isPending ? "Creating account..." : "Sign Up"}
            </Button>
          </form>
        </Form>
        
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline" data-testid="link-login">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
