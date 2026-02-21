import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import Lenis from "lenis";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { ArrowRight } from "lucide-react";
import { Button } from "./ui/button";

function OrbField() {
  const groupRef = useRef(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.08;
    groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.15) * 0.08;
  });

  return (
    <group ref={groupRef}>
      <Float speed={2.4} rotationIntensity={1.5} floatIntensity={2.6}>
        <mesh position={[-1.5, 0.25, -0.5]}>
          <sphereGeometry args={[0.7, 48, 48]} />
          <meshStandardMaterial color="#0f766e" roughness={0.2} metalness={0.35} />
        </mesh>
      </Float>
      <Float speed={2} rotationIntensity={1.2} floatIntensity={2}>
        <mesh position={[1.7, 1.1, -1.6]}>
          <sphereGeometry args={[0.35, 32, 32]} />
          <meshStandardMaterial color="#14b8a6" roughness={0.35} metalness={0.2} />
        </mesh>
      </Float>
      <Float speed={1.7} rotationIntensity={0.9} floatIntensity={1.8}>
        <mesh position={[1.2, -1.1, -1.8]}>
          <icosahedronGeometry args={[0.45, 0]} />
          <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.15} />
        </mesh>
      </Float>
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 3, 2]} intensity={1} />
    </group>
  );
}

function PremiumLanding({ onRunDemo, onClear }) {
  const scopeRef = useRef(null);

  useEffect(() => {
    const lenis = new Lenis({ smoothWheel: true, duration: 1.05 });
    let frameId = 0;

    const raf = (time) => {
      lenis.raf(time);
      frameId = requestAnimationFrame(raf);
    };

    frameId = requestAnimationFrame(raf);

    const ctx = gsap.context(() => {
      gsap.from(".reveal", {
        y: 30,
        opacity: 0,
        duration: 0.85,
        ease: "power3.out",
        stagger: 0.08,
      });
    }, scopeRef);

    return () => {
      cancelAnimationFrame(frameId);
      lenis.destroy();
      ctx.revert();
    };
  }, []);

  return (
    <div ref={scopeRef} className="relative min-h-screen overflow-hidden bg-[#151515] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_48%)]" />
      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-center px-6 pb-6 pt-10">
        <nav className="reveal hidden items-center gap-16 text-[36px] font-semibold text-stone-200 md:flex md:text-[31px]">
          <a href="#how" className="hover:text-white">How It Works</a>
          <a href="#features" className="hover:text-white">Features</a>
          <a href="#pricing" className="hover:text-white">Pricing</a>
          <a href="#signin" className="hover:text-white">Sign In</a>
        </nav>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-25">
          <Canvas camera={{ position: [0, 0, 4.4], fov: 55 }}>
            <OrbField />
          </Canvas>
        </div>
        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-28 pt-14 text-center md:pt-24">
          <h1 className="reveal text-5xl font-bold tracking-tight text-white md:text-[112px] md:leading-[1.04]">
            Your Resume. Upgraded.
          </h1>
          <p className="reveal mx-auto mt-7 max-w-4xl text-lg leading-relaxed text-stone-200 md:text-[56px] md:leading-[1.35]">
            Optimize your resume with real-time ATS scores, skill match, and expert AI recommendations.
          </p>

          <div className="reveal mt-12">
            <Button
              className="h-16 rounded-2xl bg-white px-12 text-[32px] font-medium text-stone-900 hover:bg-stone-100 md:h-24 md:px-16 md:text-[52px]"
              asChild
            >
              <Link to="/analyze" onClick={onClear}>
                Analyze My Resume <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>

          <p className="reveal mt-10 text-sm font-semibold text-stone-300 md:text-[43px]">
            Used by 5,000+ job seekers <span className="ml-2 font-bold text-white">stripe</span>
          </p>

          <button
            onClick={onRunDemo}
            className="reveal mt-6 text-xs font-medium text-stone-500 underline-offset-4 hover:text-white hover:underline md:text-base"
            type="button"
          >
            Try demo mode
          </button>
        </div>
      </section>
    </div>
  );
}

export default PremiumLanding;
