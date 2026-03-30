import { useState } from "react";
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
import { useLogin } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Flame } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const loginMutation = useLogin();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    loginMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({
          title: "Welcome back",
          description: "Successfully signed in to your sanctuary.",
        });
        setLocation("/home");
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Sign in failed",
          description: error.error || "Please check your credentials and try again.",
        });
      }
    });
  }

  return (
    <div className="flex flex-col min-h-[100dvh] w-full max-w-[430px] mx-auto bg-background p-6 relative">
      <div className="absolute top-[-10%] right-[-20%] w-[100%] h-[40%] bg-secondary/30 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex items-center mb-8 z-10 pt-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted" data-testid="button-back">
            <ArrowLeft className="w-5 h-5 text-primary" />
          </Button>
        </Link>
      </div>

      <div className="flex-1 flex flex-col z-10">
        <div className="mb-10">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-sm mb-4">
            <Flame className="w-6 h-6 text-background" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-primary mb-2">Welcome Back</h1>
          <p className="text-muted-foreground">Sign in to continue your prayer journey.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-primary font-medium">Password</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder="Enter your password" 
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
              className="w-full h-14 text-lg font-semibold rounded-xl shadow-md mt-4" 
              disabled={loginMutation.isPending}
              data-testid="button-submit-login"
            >
              {loginMutation.isPending ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </Form>
        
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/register" className="text-primary font-semibold hover:underline" data-testid="link-register">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
