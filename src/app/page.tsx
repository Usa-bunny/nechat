"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
// Menggunakan Lucide React
import { ShieldCheck, MessageSquare, PhoneCall, Globe } from "lucide-react";

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        router.push("/chat");
      } else {
        setIsLoading(false);
      }
    };
    checkUser();
  }, [router, supabase.auth]);

  const handleLoginGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/chat`,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-400 font-medium">
          Memuat Nechat...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-200">
      {/* Navigation Bar */}
      <nav className="flex items-center justify-between px-8 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">N</span>
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-800">
            Nechat
          </span>
        </div>
        <Button
          onClick={handleLoginGoogle}
          className="rounded-full px-6 font-medium bg-blue-600 hover:bg-blue-700"
        >
          Masuk
        </Button>
      </nav>

      {/* Hero Section */}
      <main className="flex flex-col items-center justify-center pt-24 pb-16 px-4 text-center">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 max-w-3xl mb-6">
          Komunikasi Cepat, Aman, dan{" "}
          <span className="text-blue-600">Terdesentralisasi.</span>
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mb-10 leading-relaxed">
          Nechat menggabungkan kecepatan antarmuka modern dengan keamanan
          kriptografi tingkat militer. Mengobrol tanpa jejak, menelepon tanpa
          batas. 100% Gratis.
        </p>

        <Button
          onClick={handleLoginGoogle}
          size="lg"
          className="rounded-full px-8 py-6 text-lg font-semibold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-3 shadow-xl hover:shadow-2xl transition-all"
        >
          {/* SVG Icon Google */}
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Lanjutkan dengan Google
        </Button>
      </main>

      {/* Features Section */}
      <section className="py-16 px-6 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center mb-4">
            <ShieldCheck size={24} strokeWidth={1.5} />
          </div>
          <h3 className="font-bold text-lg mb-2">End-to-End Encryption</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Kunci privat tersimpan aman di peramban. Tidak ada yang bisa membaca
            pesan rahasiamu, bahkan kami sekalipun.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4">
            <MessageSquare size={24} strokeWidth={1.5} />
          </div>
          <h3 className="font-bold text-lg mb-2">Public & Private Rooms</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Ikuti obrolan publik untuk bertemu teman baru, atau buat ruang
            privat dengan sistem pertemanan ala sosial media.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mb-4">
            <PhoneCall size={24} strokeWidth={1.5} />
          </div>
          <h3 className="font-bold text-lg mb-2">P2P Voice Call</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Telepon suara sejernih kristal secara langsung (Peer-to-Peer)
            menggunakan WebRTC tanpa latensi server.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4">
            <Globe size={24} strokeWidth={1.5} />
          </div>
          <h3 className="font-bold text-lg mb-2">Media Tak Terbatas</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Kirim gambar, video, dan dokumen secara aman. Semua tautan file
            dienkripsi sebelum dikirim ke database.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-slate-400 text-sm border-t border-slate-200 mt-10">
        <p>Dirancang & Dibangun oleh Usagi. © 2026 Nechat.</p>
      </footer>
    </div>
  );
}
