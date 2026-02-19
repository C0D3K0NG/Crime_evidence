import Link from "next/link";
import { ArrowRight, Shield, FileText, Link2, Users, Lock, Database } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans overflow-x-hidden">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xl font-bold text-foreground">BlockEvidence</span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="#features" className="hover:text-foreground transition-colors">Features</Link>
            <Link href="#how-it-works" className="hover:text-foreground transition-colors">How it Works</Link>
            <Link href="#about" className="hover:text-foreground transition-colors">About</Link>
          </div>

          <Link
            href="/login"
            className="hidden md:inline-flex items-center gap-2 bg-primary text-primary-foreground font-medium px-5 py-2 rounded-lg hover:bg-primary/90 transition-colors text-sm"
          >
            Sign In <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1">
        <div className="container mx-auto px-6 pt-20 pb-24">
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto space-y-8">
            <div className="inline-flex items-center gap-2 border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs text-primary font-medium rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
              Secure Evidence Management Platform
            </div>

            <div className="space-y-4">
              <h1 className="text-5xl md:text-6xl font-bold leading-tight tracking-tight text-foreground">
                Manage Evidence <br />
                <span className="text-primary">with Confidence</span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
                A secure platform for law enforcement to register, track, and share
                evidence across teams. Maintain a clear chain of custody from
                collection to courtroom.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
              <Link
                href="/register"
                className="w-full sm:w-auto bg-primary text-primary-foreground font-semibold px-8 py-3 rounded-lg hover:bg-primary/90 transition-all text-sm"
              >
                Get Started
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto border border-border text-foreground font-medium px-8 py-3 rounded-lg hover:bg-muted transition-all text-sm"
              >
                Sign In
              </Link>
            </div>
          </div>

          {/* Features Grid */}
          <div id="features" className="mt-24 grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="p-6 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
                <Database className="h-5 w-5 text-blue-500" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Evidence Tracking</h3>
              <p className="text-sm text-muted-foreground">
                Register and track physical, digital, and testimonial evidence with full audit trails.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4">
                <Lock className="h-5 w-5 text-emerald-500" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Chain of Custody</h3>
              <p className="text-sm text-muted-foreground">
                Every transfer is logged. Know exactly who handled evidence and when.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
                <Users className="h-5 w-5 text-purple-500" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Team Collaboration</h3>
              <p className="text-sm text-muted-foreground">
                Share evidence securely across officers, lawyers, and judges using Crime Boxes.
              </p>
            </div>
          </div>

          {/* How it Works */}
          <div id="how-it-works" className="mt-24 max-w-3xl mx-auto text-center space-y-12">
            <h2 className="text-3xl font-bold text-foreground">How it Works</h2>
            <div className="grid sm:grid-cols-3 gap-8 text-left">
              <div className="space-y-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">1</div>
                <h3 className="font-semibold text-foreground">Create a Crime Box</h3>
                <p className="text-sm text-muted-foreground">Head Officers create a box for a case and get private/public keys to share with the team.</p>
              </div>
              <div className="space-y-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">2</div>
                <h3 className="font-semibold text-foreground">Register Evidence</h3>
                <p className="text-sm text-muted-foreground">Officers log evidence items with descriptions, photos, location, and chain of custody details.</p>
              </div>
              <div className="space-y-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">3</div>
                <h3 className="font-semibold text-foreground">Share & Review</h3>
                <p className="text-sm text-muted-foreground">Lawyers and judges join with a public key to review evidence in read-only mode.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="container mx-auto py-8 px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>© 2026 BlockEvidence. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="#" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="#" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="#" className="hover:text-foreground transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
