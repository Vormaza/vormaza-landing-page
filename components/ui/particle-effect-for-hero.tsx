import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    MousePointer2, Info, ArrowRight, ArrowDown,
    Gamepad2, MessageCircle, Music, Instagram,
    Twitter, Youtube, Twitch, Video, Ghost,
    User, Mail, Phone, ExternalLink, Coffee, Quote
} from 'lucide-react';

// --- Types ---

interface Particle {
    x: number;
    y: number;
    originX: number;
    originY: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    angle: number;
}

interface BackgroundParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
    phase: number;
}

interface MouseState {
    x: number;
    y: number;
    isActive: boolean;
}

// --- Custom Icons ---

interface IconProps {
    className?: string;
    size?: number | string;
}

const XIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

const TikTokIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
);

const SpotifyIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
);

const TechQuoteIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        {/* Minimalist geometric quote mark - slanted rectangles for a tech/speed look */}
        <path d="M10 6L8 18h2.5l2-12h-2.5zm6 0l-2 12h2.5l2-12H16z" />
    </svg>
);

// --- Configuration Constants ---

const PARTICLE_DENSITY = 0.00015;
const BG_PARTICLE_DENSITY = 0.00005;
const MOUSE_RADIUS = 250;
const RETURN_SPEED = 0.05; // Slightly looser spring for better scroll effect
const DAMPING = 0.92; // Slightly more slippery
const REPULSION_STRENGTH = 1.2;

// --- Helper Functions ---

const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

// Linear interpolation for arrays of length 3 (RGB)
const lerpColor = (start: number[], end: number[], factor: number) => {
    const result = [];
    for (let i = 0; i < 3; i++) {
        result[i] = Math.round(start[i] + (end[i] - start[i]) * factor);
    }
    return result;
}

// --- Mobile Detection Hook ---

const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return isMobile;
};

// --- Components ---

interface AntiGravityCanvasProps {
    scrollRef: React.RefObject<HTMLDivElement | null>;
    fpsRef: React.RefObject<HTMLSpanElement | null>;
    setEntityCount: (count: number) => void;
}

const AntiGravityCanvas: React.FC<AntiGravityCanvasProps> = ({ scrollRef, fpsRef, setEntityCount }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const particlesRef = useRef<Particle[]>([]);
    const backgroundParticlesRef = useRef<BackgroundParticle[]>([]);
    const mouseRef = useRef<MouseState>({ x: -1000, y: -1000, isActive: false });
    const frameIdRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);

    // FPS Tracking
    const lastFpsTimeRef = useRef<number>(0);
    const frameCountRef = useRef<number>(0);

    // Track scroll for physics calculation
    const lastScrollTopRef = useRef<number>(0);

    // Initialize Particles
    const initParticles = useCallback((width: number, height: number) => {
        const particleCount = Math.floor(width * height * PARTICLE_DENSITY);
        const newParticles: Particle[] = [];

        for (let i = 0; i < particleCount; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;

            newParticles.push({
                x: x,
                y: y,
                originX: x,
                originY: y,
                vx: 0,
                vy: 0,
                size: randomRange(1, 2.5),
                color: Math.random() > 0.9 ? '#4285F4' : '#ffffff',
                angle: Math.random() * Math.PI * 2,
            });
        }
        particlesRef.current = newParticles;

        const bgCount = Math.floor(width * height * BG_PARTICLE_DENSITY);
        const newBgParticles: BackgroundParticle[] = [];

        for (let i = 0; i < bgCount; i++) {
            newBgParticles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.2,
                vy: (Math.random() - 0.5) * 0.2,
                size: randomRange(0.5, 1.5),
                alpha: randomRange(0.1, 0.4),
                phase: Math.random() * Math.PI * 2
            });
        }
        backgroundParticlesRef.current = newBgParticles;

        // Update total entities count
        setEntityCount(particleCount + bgCount);

    }, [setEntityCount]);

    // Animation Loop
    const animate = useCallback((time: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        lastTimeRef.current = time;

        // --- FPS Calculation ---
        frameCountRef.current++;
        if (time - lastFpsTimeRef.current >= 1000) {
            if (fpsRef.current) {
                fpsRef.current.innerText = `FPS: ${frameCountRef.current}`;
            }
            frameCountRef.current = 0;
            lastFpsTimeRef.current = time;
        }

        // --- Scroll Physics & Logic ---
        let scrollDelta = 0;
        let scrollProgress = 0;

        if (scrollRef.current) {
            const currentScroll = scrollRef.current.scrollTop;
            const maxScroll = scrollRef.current.scrollHeight - scrollRef.current.clientHeight;

            scrollDelta = currentScroll - lastScrollTopRef.current;
            lastScrollTopRef.current = currentScroll;

            // Normalize scroll progress (0 to 1 based on sections, assuming approx 100vh per section)
            // We have 3 sections, so max index is roughly 2.
            scrollProgress = Math.min(Math.max(currentScroll / window.innerHeight, 0), 2);
        }

        const scrollForce = -scrollDelta * 0.05; // Negative because scrolling down moves content up, so particles fly up

        // --- Colors ---
        // Section 0: Blue [66, 133, 244]
        // Section 1: Purple [147, 51, 234]
        // Section 2: Cyan [34, 211, 238]

        let currentColor = [66, 133, 244];
        if (scrollProgress <= 1) {
            currentColor = lerpColor([66, 133, 244], [147, 51, 234], scrollProgress);
        } else {
            currentColor = lerpColor([147, 51, 234], [34, 211, 238], scrollProgress - 1);
        }
        const rgbString = `${currentColor[0]}, ${currentColor[1]}, ${currentColor[2]}`;


        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // --- Background Effects ---
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const pulseSpeed = 0.0008;
        const pulseOpacity = Math.sin(time * pulseSpeed) * 0.035 + 0.085;

        const gradient = ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, Math.max(canvas.width, canvas.height) * 0.7
        );
        // Dynamic color based on scroll
        gradient.addColorStop(0, `rgba(${rgbString}, ${pulseOpacity})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const bgParticles = backgroundParticlesRef.current;
        ctx.fillStyle = "#ffffff";

        for (let i = 0; i < bgParticles.length; i++) {
            const p = bgParticles[i];
            p.x += p.vx;
            p.y += p.vy + (scrollForce * 0.1); // Background moves less

            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;

            const twinkle = Math.sin(time * 0.002 + p.phase) * 0.5 + 0.5;
            const currentAlpha = p.alpha * (0.3 + 0.7 * twinkle);

            ctx.globalAlpha = currentAlpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        // --- Main Foreground Physics ---
        const particles = particlesRef.current;
        const mouse = mouseRef.current;

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];

            // 1. Mouse Interaction
            const dx = mouse.x - p.x;
            const dy = mouse.y - p.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (mouse.isActive && distance < MOUSE_RADIUS) {
                const forceDirectionX = dx / distance;
                const forceDirectionY = dy / distance;
                const force = (MOUSE_RADIUS - distance) / MOUSE_RADIUS;
                const repulsion = force * REPULSION_STRENGTH;
                p.vx -= forceDirectionX * repulsion * 5;
                p.vy -= forceDirectionY * repulsion * 5;
            }

            // 2. Scroll Interaction (Wind)
            // Add vertical velocity based on scroll speed
            p.vy += scrollForce;


            // 3. Spring Force
            const springDx = p.originX - p.x;
            const springDy = p.originY - p.y;

            p.vx += springDx * RETURN_SPEED;
            p.vy += springDy * RETURN_SPEED;
        }

        // Simplified Collision
        for (let i = 0; i < particles.length; i++) {
            const p1 = particles[i];
            if (i % 2 === 0) {
                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    const distSq = dx * dx + dy * dy;
                    const minDist = p1.size + p2.size;

                    if (distSq < minDist * minDist) {
                        const dist = Math.sqrt(distSq);
                        if (dist > 0.01) {
                            const nx = dx / dist;
                            const ny = dy / dist;
                            const overlap = minDist - dist;
                            const pushX = nx * overlap * 0.5;
                            const pushY = ny * overlap * 0.5;
                            p1.x -= pushX;
                            p1.y -= pushY;
                            p2.x += pushX;
                            p2.y += pushY;
                        }
                    }
                }
            }

            p1.vx *= DAMPING;
            p1.vy *= DAMPING;
            p1.x += p1.vx;
            p1.y += p1.vy;

            ctx.beginPath();
            ctx.arc(p1.x, p1.y, p1.size, 0, Math.PI * 2);
            const velocity = Math.sqrt(p1.vx * p1.vx + p1.vy * p1.vy);
            const opacity = Math.min(0.3 + velocity * 0.1, 1);

            // Dynamic color matching the background gradient for 10% of particles
            // providing a subtle integration with the theme
            if (Math.random() > 0.995) {
                ctx.fillStyle = `rgba(${rgbString}, ${opacity})`;
            } else {
                ctx.fillStyle = p1.color === '#ffffff'
                    ? `rgba(255, 255, 255, ${opacity})`
                    : p1.color;
            }

            ctx.fill();
        }

        frameIdRef.current = requestAnimationFrame(animate);
    }, [scrollRef, fpsRef]); // Dependency on scrollRef and fpsRef

    // Resize Handler
    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current && canvasRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                const dpr = window.devicePixelRatio || 1;

                canvasRef.current.width = width * dpr;
                canvasRef.current.height = height * dpr;
                canvasRef.current.style.width = `${width}px`;
                canvasRef.current.style.height = `${height}px`;

                const ctx = canvasRef.current.getContext('2d');
                if (ctx) ctx.scale(dpr, dpr);

                initParticles(width, height);
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => window.removeEventListener('resize', handleResize);
    }, [initParticles]);

    // Global Mouse Handlers
    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => {
            mouseRef.current = {
                x: e.clientX,
                y: e.clientY,
                isActive: true,
            };
        };

        const handleGlobalMouseLeave = () => {
            mouseRef.current.isActive = false;
        };

        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseout', handleGlobalMouseLeave);

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseout', handleGlobalMouseLeave);
        }
    }, []);

    // Start Animation
    useEffect(() => {
        frameIdRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frameIdRef.current);
    }, [animate]);

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-0 overflow-hidden bg-black pointer-events-none"
        >
            <canvas ref={canvasRef} className="block w-full h-full" />
        </div>
    );
};

interface SystemOverlayProps {
    fpsRef: React.RefObject<HTMLSpanElement | null>;
    entityCount: number;
}

const SystemOverlay: React.FC<SystemOverlayProps> = ({ fpsRef, entityCount }) => {
    const [time, setTime] = useState(new Date());
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const interval = setInterval(() => setTime(new Date()), 1000);
        const handleMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
        window.addEventListener('mousemove', handleMove);
        return () => {
            clearInterval(interval);
            window.removeEventListener('mousemove', handleMove);
        }
    }, []);

    return (
        <>
            {/* Bottom Left: System Stats */}
            <div className="fixed bottom-6 left-6 md:bottom-8 md:left-8 z-50 font-mono text-[10px] md:text-xs text-blue-200/40 flex flex-col gap-1 pointer-events-none select-none tracking-wider mix-blend-difference">
                <div className="flex items-center gap-2 mb-1">
                    <div className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </div>
                    <span className="font-bold text-blue-100/60">SYSTEM STATUS: ONLINE</span>
                </div>
                <div className="flex gap-4">
                    <span>CX: {mousePos.x.toString().padStart(4, '0')}</span>
                    <span>CY: {mousePos.y.toString().padStart(4, '0')}</span>
                </div>
                <div>LOC_TIME: {time.toLocaleTimeString([], { hour12: false })}</div>
                <div className="text-cyan-300/60">SYS_TIME: {time.toLocaleTimeString('en-US', { timeZone: 'Asia/Jakarta', hour12: false })} (GMT+7)</div>
            </div>

            {/* Bottom Right: Performance Stats */}
            <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 font-mono text-[10px] md:text-xs text-blue-200/40 flex flex-col gap-1 items-end pointer-events-none select-none tracking-wider mix-blend-difference">
                <div className="flex gap-4 border-b border-blue-500/10 pb-1 mb-1">
                    <span ref={fpsRef} className="w-16 text-right">FPS: --</span>
                    <span>PING: 1ms</span>
                </div>
                <span>ENTITIES: {entityCount}</span>
                <span>MEM: {Math.floor(entityCount * 0.45)}MB</span>
                <span className="opacity-50 mt-1">v2.0.5</span>
            </div>
        </>
    )
}

interface NavigationProps {
    scrollRef: React.RefObject<HTMLDivElement | null>;
    isMobile?: boolean;
}

const Navigation: React.FC<NavigationProps> = ({ scrollRef, isMobile }) => {
    const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
        e.preventDefault();
        const element = document.getElementById(id);

        if (isMobile) {
            // On mobile, use window scroll
            element?.scrollIntoView({ behavior: 'smooth' });
        } else {
            const container = scrollRef.current;
            if (element && container) {
                const topPos = element.offsetTop;
                container.scrollTo({
                    top: topPos,
                    behavior: 'smooth'
                });
            }
        }
    };

    return (
        <nav className={`fixed top-0 left-0 w-full z-50 flex justify-between items-center p-4 md:p-6 lg:p-8 ${isMobile ? 'bg-black/95' : 'backdrop-blur-[2px]'}`} aria-label="Main navigation">
            <a href="#hero-section" onClick={(e) => scrollToSection(e, 'hero-section')} className="flex items-center space-x-3 pointer-events-auto cursor-pointer group" aria-label="Back to home">
                <div className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} flex items-center justify-center transition-transform group-hover:rotate-6 duration-500`}>
                    <img
                        src="https://i.imgur.com/yN7d3DV.png"
                        alt="Vormaza logo"
                        className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]"
                    />
                </div>
                <span className={`text-white font-medium tracking-widest uppercase group-hover:text-blue-300 transition-colors ${isMobile ? 'text-base' : 'text-lg'}`}>vormaza</span>
            </a>
            <div className={`flex ${isMobile ? 'space-x-4' : 'space-x-6 md:space-x-10'} text-sm font-bold tracking-widest uppercase text-white/50 pointer-events-auto`}>
                <a href="#links-section" onClick={(e) => scrollToSection(e, 'links-section')} className="hover:text-white transition-all duration-300" aria-label="Navigate to Links section">Links</a>
                <a href="#contact-section" onClick={(e) => scrollToSection(e, 'contact-section')} className="hover:text-white transition-all duration-300" aria-label="Navigate to Contact section">Contact</a>
            </div>
        </nav>
    )
}

interface SectionProps {
    scrollToLinks?: () => void;
    isMobile?: boolean;
}

const HeroContent: React.FC<SectionProps> = ({ scrollToLinks, isMobile }) => {
    const [titleHover, setTitleHover] = useState<'vor' | 'maza' | null>(null);

    return (
        <section id="hero-section" className={`relative w-full flex flex-col items-center justify-center px-4 overflow-hidden ${isMobile ? 'min-h-[70vh] py-24 pt-28' : 'h-screen snap-start'}`}>
            <div className={`max-w-5xl w-full text-center pointer-events-none ${isMobile ? 'space-y-6' : 'space-y-8 mt-12'}`}>
                <div className="inline-block animate-fade-in-up pointer-events-auto" style={{ animationDelay: '0.1s' }}>
                    <div className="group relative cursor-help">
                        <span className={`py-2 px-4 border border-blue-500/30 rounded-full text-xs font-mono text-blue-300/80 tracking-[0.3em] uppercase bg-blue-900/10 shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-colors ${isMobile ? '' : 'backdrop-blur-sm group-hover:bg-blue-900/20 group-hover:border-blue-500/50'}`}>
                            Identity
                        </span>
                        {/* Tooltip - hide on mobile */}
                        {!isMobile && (
                            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-4 w-max px-4 py-2 bg-black/80 border border-blue-500/20 rounded-lg text-[10px] font-mono text-blue-200/70 tracking-widest backdrop-blur-md opacity-0 transform translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 pointer-events-none shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                                AKA: vor / vormaz / maza
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black/80 border-t border-l border-blue-500/20 rotate-45"></div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-2 pointer-events-auto z-10 relative">
                    <h1 className={`flex justify-center items-center font-black tracking-tighter animate-fade-in-up leading-none pointer-events-none ${isMobile ? 'text-5xl' : 'text-7xl md:text-9xl lg:text-[11rem] mix-blend-difference'}`} style={{ animationDelay: '0.2s' }}>
                        <span
                            className={`pointer-events-auto cursor-default transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${isMobile
                                ? 'text-white'
                                : titleHover === 'maza' ? 'opacity-20 blur-[3px] scale-95' :
                                    titleHover === 'vor' ? 'opacity-100 blur-0 scale-105 drop-shadow-[0_0_25px_rgba(255,255,255,0.7)] text-white' :
                                        'opacity-90 text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/10'
                                }`}
                            onMouseEnter={() => !isMobile && setTitleHover('vor')}
                            onMouseLeave={() => !isMobile && setTitleHover(null)}
                        >
                            vor
                        </span>
                        <span
                            className={`pointer-events-auto cursor-default transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${isMobile
                                ? 'text-white'
                                : titleHover === 'vor' ? 'opacity-20 blur-[3px] scale-95' :
                                    titleHover === 'maza' ? 'opacity-100 blur-0 scale-105 drop-shadow-[0_0_25px_rgba(255,255,255,0.7)] text-white' :
                                        'opacity-90 text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/10'
                                }`}
                            onMouseEnter={() => !isMobile && setTitleHover('maza')}
                            onMouseLeave={() => !isMobile && setTitleHover(null)}
                        >
                            maza
                        </span>
                    </h1>
                    <p className={`text-white/30 font-mono tracking-widest animate-fade-in-up pointer-events-none ${isMobile ? 'text-lg' : 'text-xl md:text-2xl'}`} style={{ animationDelay: '0.4s' }}>
                        /vɔrˈmɑːzə/
                    </p>
                </div>

                {/* Quote with Icons */}
                <div className={`relative animate-fade-in-up flex justify-center ${isMobile ? 'mt-8' : 'mt-12'}`} style={{ animationDelay: '0.6s' }}>
                    <div className="relative inline-block px-2">
                        <TechQuoteIcon
                            className={`absolute -top-4 w-6 h-6 md:w-8 md:h-8 text-cyan-500/20 fill-cyan-500/10 ${isMobile ? '-left-4' : '-left-6 md:-left-10 drop-shadow-[0_0_2px_rgba(34,211,238,0.2)]'}`}
                        />
                        <p className={`text-white/80 font-light italic leading-relaxed text-center tracking-wide ${isMobile ? 'text-base' : 'text-lg md:text-2xl'}`}>
                            A reliable and trustworthy gamer,
                            <br className="block" />
                            I wouldn't see a reason to be afraid.
                        </p>
                        <TechQuoteIcon
                            className={`absolute -bottom-4 w-6 h-6 md:w-8 md:h-8 text-cyan-500/20 fill-cyan-500/10 rotate-180 ${isMobile ? '-right-4' : '-right-6 md:-right-10 drop-shadow-[0_0_2px_rgba(34,211,238,0.2)]'}`}
                        />
                    </div>
                </div>

                {/* Enter button - Desktop only */}
                {!isMobile && (
                    <div className="pt-12 pointer-events-auto animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
                        <button
                            onClick={scrollToLinks}
                            className="group relative inline-flex items-center gap-4 px-12 py-6 bg-transparent border border-white/30 text-white text-lg rounded-none font-bold tracking-[0.2em] uppercase overflow-hidden transition-all duration-300 hover:border-white hover:text-black hover:shadow-[0_0_40px_rgba(255,255,255,0.4)]"
                        >
                            <span className="relative z-10">Enter</span>
                            <ArrowDown className="w-5 h-5 relative z-10 group-hover:translate-y-1 transition-transform" />
                            <div className="absolute inset-0 bg-white transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out z-0"></div>
                        </button>
                    </div>
                )}
            </div>

            {/* Scroll Indicator - Desktop only */}
            {!isMobile && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/20 animate-pulse-slow pointer-events-none">
                    <span className="text-[10px] uppercase tracking-[0.3em] font-mono">Scroll</span>
                    <div className="h-12 w-[1px] bg-gradient-to-b from-white/0 via-white/50 to-white/0"></div>
                </div>
            )}
        </section>
    );
};

interface LinksSectionProps {
    isMobile?: boolean;
}

const LinksSection: React.FC<LinksSectionProps> = ({ isMobile }) => {
    const links = [
        {
            name: 'Discord',
            url: 'https://discord.gg/yoigan-451760111417819146',
            icon: MessageCircle,
            shadow: 'hover:shadow-[0_0_30px_-5px_rgba(129,140,248,0.6)]',
            border: 'hover:border-indigo-500/50',
            iconColor: 'text-indigo-400 group-hover:text-indigo-300'
        },
        {
            name: 'Steam',
            url: 'https://steamcommunity.com/id/Vormaza/',
            icon: Gamepad2,
            shadow: 'hover:shadow-[0_0_30px_-5px_rgba(96,165,250,0.6)]',
            border: 'hover:border-blue-400/50',
            iconColor: 'text-blue-400 group-hover:text-blue-300'
        },
        {
            name: 'Secreto',
            url: 'https://secreto.site/arofj6',
            icon: Ghost,
            shadow: 'hover:shadow-[0_0_30px_-5px_rgba(244,114,182,0.6)]',
            border: 'hover:border-pink-400/50',
            iconColor: 'text-pink-400 group-hover:text-pink-300'
        },
        {
            name: 'MyNickname',
            url: 'https://mynickname.com/en/Vormaza',
            icon: User,
            shadow: 'hover:shadow-[0_0_30px_-5px_rgba(74,222,128,0.6)]',
            border: 'hover:border-green-400/50',
            iconColor: 'text-green-400 group-hover:text-green-300'
        },
        {
            name: 'Spotify',
            url: 'https://open.spotify.com/user/vormaza',
            icon: SpotifyIcon,
            shadow: 'hover:shadow-[0_0_30px_-5px_rgba(34,197,94,0.6)]',
            border: 'hover:border-green-500/50',
            iconColor: 'text-green-500 group-hover:text-green-400'
        },
        {
            name: 'Instagram',
            url: 'https://www.instagram.com/vormaz/',
            icon: Instagram,
            shadow: 'hover:shadow-[0_0_30px_-5px_rgba(192,132,252,0.6)]',
            border: 'hover:border-purple-400/50',
            iconColor: 'text-purple-400 group-hover:text-purple-300'
        },
        {
            name: 'Reddit',
            url: 'https://www.reddit.com/user/Vormaza/',
            icon: MessageCircle,
            shadow: 'hover:shadow-[0_0_30px_-5px_rgba(251,146,60,0.6)]',
            border: 'hover:border-orange-400/50',
            iconColor: 'text-orange-400 group-hover:text-orange-300'
        },
        {
            name: 'TikTok',
            url: 'https://www.tiktok.com/@vormaza',
            icon: TikTokIcon,
            shadow: 'hover:shadow-[0_0_30px_-5px_rgba(34,211,238,0.6)]',
            border: 'hover:border-cyan-400/50',
            iconColor: 'text-cyan-400 group-hover:text-cyan-300'
        },
        {
            name: 'Twitch',
            url: 'https://www.twitch.tv/vormaza',
            icon: Twitch,
            shadow: 'hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.6)]',
            border: 'hover:border-purple-500/50',
            iconColor: 'text-purple-500 group-hover:text-purple-400'
        },
        {
            name: 'X (Twitter)',
            url: 'https://x.com/Vormarza',
            icon: XIcon,
            shadow: 'hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.6)]',
            border: 'hover:border-white/50',
            iconColor: 'text-white group-hover:text-white/80'
        },
        {
            name: 'YouTube',
            url: 'https://www.youtube.com/vormaz',
            icon: Youtube,
            shadow: 'hover:shadow-[0_0_30px_-5px_rgba(239,68,68,0.6)]',
            border: 'hover:border-red-500/50',
            iconColor: 'text-red-500 group-hover:text-red-400'
        },
        {
            name: 'Ko-fi',
            url: 'https://ko-fi.com/vormaza',
            icon: Coffee,
            shadow: 'hover:shadow-[0_0_30px_-5px_rgba(250,204,21,0.6)]',
            border: 'hover:border-yellow-400/50',
            iconColor: 'text-yellow-400 group-hover:text-yellow-300'
        },
    ];

    return (
        <section id="links-section" className={`relative w-full flex flex-col items-center justify-center px-4 overflow-hidden ${isMobile ? 'py-12' : 'h-screen snap-start py-20'}`}>
            <div className="max-w-6xl w-full">
                <h2 className={`font-bold text-white mb-4 text-center tracking-tighter ${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl mix-blend-difference'}`}>
                    <span className="text-purple-500">.</span>Network
                </h2>

                <p className={`text-white/50 font-light text-center max-w-2xl mx-auto ${isMobile ? 'text-base mb-6' : 'text-xl mb-12'}`}>
                    Establish digital handshake with external nodes.
                </p>

                {/* Links grid - different layout for mobile */}
                <div className={`${isMobile ? 'flex flex-col gap-3 px-2' : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 max-h-[60vh] overflow-y-auto no-scrollbar p-10 -mx-6'}`}>
                    {links.map((link) => (
                        <a
                            key={link.name}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`group relative bg-white/5 border border-white/10 ${isMobile
                                ? 'flex items-center gap-4 p-4 rounded-lg active:bg-white/10'
                                : `flex items-center gap-4 p-6 backdrop-blur-md transition-all duration-500 hover:-translate-y-2 hover:scale-[1.02] ${link.border} ${link.shadow}`
                                }`}
                        >
                            <div className={`${isMobile ? 'p-2' : 'p-3'} bg-black/40 rounded-lg transition-colors duration-300 ${isMobile ? link.iconColor.split(' ')[0] : link.iconColor}`}>
                                <link.icon size={isMobile ? 20 : 24} />
                            </div>

                            {/* Desktop: vertical stack with name + connect */}
                            {!isMobile && (
                                <div className="flex flex-col relative z-10">
                                    <span className="text-white font-medium tracking-wide text-lg group-hover:text-white transition-colors">{link.name}</span>
                                    <span className="text-white/30 text-xs font-mono tracking-widest uppercase group-hover:text-white/60 transition-colors">Connect</span>
                                </div>
                            )}

                            {/* Mobile: just name */}
                            {isMobile && (
                                <span className="text-white font-medium tracking-wide text-base">{link.name}</span>
                            )}

                            {/* Desktop only decorations */}
                            {!isMobile && (
                                <>
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/0 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-sm pointer-events-none" />
                                    <ExternalLink size={16} className="absolute top-4 right-4 text-white/10 group-hover:text-white/40 transition-colors" />
                                </>
                            )}

                            {/* Mobile chevron */}
                            {isMobile && (
                                <ExternalLink size={16} className="ml-auto text-white/30" />
                            )}
                        </a>
                    ))}
                </div>
            </div>
        </section>
    )
}

interface ContactSectionProps {
    isMobile?: boolean;
}

const ContactSection: React.FC<ContactSectionProps> = ({ isMobile }) => {
    return (
        <section id="contact-section" className={`relative w-full flex flex-col items-center justify-center px-4 overflow-hidden ${isMobile ? 'py-16' : 'h-screen snap-start py-20'}`}>
            <div className={`max-w-4xl w-full text-center ${isMobile ? 'space-y-8' : 'space-y-12'}`}>
                <h2 className={`font-bold text-white tracking-tighter ${isMobile ? 'text-3xl' : 'text-4xl md:text-6xl'}`}>
                    <span className="text-cyan-400">.</span>Signal
                </h2>
                <p className={`text-white/50 font-light ${isMobile ? 'text-base' : 'text-xl'}`}>
                    Initiate a connection protocol.
                </p>

                <div className={`flex flex-col gap-4 justify-center items-center ${isMobile ? '' : 'md:flex-row gap-6'}`}>
                    <a
                        href="mailto:vormaza.id@gmail.com"
                        className={`group relative w-full flex items-center justify-center gap-3 bg-transparent border border-white text-white font-bold tracking-widest uppercase overflow-hidden transition-all duration-300 ${isMobile
                            ? 'px-6 py-4 text-sm active:bg-cyan-400 active:text-black'
                            : 'md:w-auto min-w-[200px] px-8 py-4 hover:border-cyan-400 hover:text-black'
                            }`}
                    >
                        {/* Animated Background Fill - Desktop only */}
                        {!isMobile && <span className="absolute inset-0 translate-y-full group-hover:translate-y-0 bg-cyan-400 transition-transform duration-300 ease-out z-0"></span>}

                        <div className="relative z-10 flex items-center gap-3">
                            <Mail className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5 group-hover:scale-110 transition-transform'}`} />
                            <span>Email</span>
                        </div>
                    </a>

                    <a
                        href="tel:+6285155365411"
                        className={`group relative w-full flex items-center justify-center gap-3 bg-transparent border border-white/30 text-white font-bold tracking-widest uppercase overflow-hidden transition-all duration-300 ${isMobile
                            ? 'px-6 py-4 text-sm active:bg-white active:text-black'
                            : 'md:w-auto min-w-[200px] px-8 py-4 hover:border-white hover:text-black'
                            }`}
                    >
                        {/* Animated Background Fill - Desktop only */}
                        {!isMobile && <span className="absolute inset-0 translate-y-full group-hover:translate-y-0 bg-white transition-transform duration-300 ease-out z-0"></span>}

                        <div className="relative z-10 flex items-center gap-3">
                            <Phone className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5 group-hover:scale-110 transition-transform'}`} />
                            <span>Contact</span>
                        </div>
                    </a>
                </div>

                <div className={`${isMobile ? 'pt-8' : 'pt-20'}`}>
                    <span className="text-white/20 font-mono text-xs tracking-[0.5em] uppercase">
                        vormaza © {new Date().getFullYear()}
                    </span>
                </div>
            </div>
        </section>
    )
}

// --- Main App Component ---

export default function ParticleEffectHero() {
    const scrollRef = useRef<HTMLDivElement>(null);
    const fpsRef = useRef<HTMLSpanElement>(null);
    const [entityCount, setEntityCount] = useState(0);
    const isMobile = useIsMobile();

    const handleHeroEnterClick = () => {
        if (scrollRef.current) {
            const linksSection = document.getElementById('links-section');
            if (linksSection) {
                scrollRef.current.scrollTo({
                    top: linksSection.offsetTop,
                    behavior: 'smooth'
                });
            }
        }
    };

    return (
        <div className={`relative w-full bg-black text-white selection:bg-blue-500 selection:text-white ${isMobile ? 'min-h-screen overflow-y-auto' : 'h-screen overflow-hidden'}`}>
            {/* Fixed Background with Scroll Awareness - Desktop only */}
            {!isMobile && <AntiGravityCanvas scrollRef={scrollRef} fpsRef={fpsRef} setEntityCount={setEntityCount} />}

            {/* Simple static background for mobile */}
            {isMobile && <div className="fixed inset-0 bg-gradient-to-b from-black via-gray-900 to-black z-0" />}

            {/* System Overlay (Tech UI) - Desktop only */}
            {!isMobile && <SystemOverlay fpsRef={fpsRef} entityCount={entityCount} />}

            {/* Navigation (Fixed Overlay) */}
            <Navigation scrollRef={scrollRef} isMobile={isMobile} />

            {/* Scrollable Content Overlay */}
            <div
                ref={scrollRef}
                className={`relative w-full z-10 ${isMobile ? 'overflow-visible' : 'h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar'}`}
            >
                <HeroContent scrollToLinks={handleHeroEnterClick} isMobile={isMobile} />
                <LinksSection isMobile={isMobile} />
                <ContactSection isMobile={isMobile} />
            </div>

        </div>
    );
}