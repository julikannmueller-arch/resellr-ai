import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerkAppearance";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0A0A0A] px-4">
      <Link
        href="/"
        className="mb-8 font-extrabold text-xl tracking-tight text-white hover:text-white/80 transition-colors"
      >
        Resellr AI
      </Link>
      <SignUp appearance={clerkAppearance} />
      <p className="mt-6 text-[#535353] text-xs">
        ← <Link href="/" className="hover:text-[#B3B3B3] transition-colors">Back to Generator</Link>
      </p>
    </div>
  );
}
