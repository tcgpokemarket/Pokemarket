import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In or Create Account",
  description: "Sign in to your TCG Poke Market account or create a new one to start buying and selling Pokémon TCG cards.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
