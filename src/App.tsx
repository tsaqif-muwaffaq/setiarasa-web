/* src/App.tsx - FULL VERSION WITH DARK MODE */
import { QueryClient, QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  AlertCircle, ArrowRight, CheckCircle, ChevronRight, ChefHat, Clock, Clock3,
  ExternalLink, Loader2, MapPin, Menu as MenuIcon, Minus, Moon, PackageCheck,
  Phone, Plus, Search, ShieldCheck, ShoppingBag, Sun, Trash2, Utensils, X,
  Copy, CheckCheck, Banknote, QrCode, Info
} from 'lucide-react';
import {
  BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate,
} from 'react-router-dom';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ChangeEvent, type FormEvent, type ReactNode,
} from 'react';

// --- CONSTANTS ---
const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/public`;
const ADMIN_LOGIN_URL = 'http://localhost:5173/login';
const LOGO_IMAGE_URL = '/logo.png';
const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80';
const MAPS_EMBED_URL = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3989.1550423712315!2d103.94229!3d1.0447560000000002!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31d98d6b6a25f7ed%3A0x99b387a20aab3153!2sRM%20SETIA%20RASA!5e0!3m2!1sid!2sid!4v1782381864615!5m2!1sid!2sid';
const CONTACT_INFO = {
  address: 'Perumahan Taman Batu Aji Indah 2, Blok N No. 28, Sagulung, Kota Batam, Kepulauan Riau 29444',
  whatsapp: '0857-6757-1976',
  whatsappUrl: 'https://wa.me/6285767571976',
  openingHours: 'Setiap Hari, 16:00 - 00:00',
};
const ORDER_NOTES_MAX_LENGTH = 280;
const GEOLOCATION_TIMEOUT_MS = 12000;
const REVERSE_GEOCODE_URL = 'https://nominatim.openstreetmap.org/reverse';

// --- TYPES ---
type MenuItem = { id: string; name: string; description?: string | null; price: number; category: string; imageUrl: string; stock: number; isAvailable: boolean; createdAt?: string; };
type CartItem = MenuItem & { quantity: number; };
type OrderType = 'Makan di Tempat' | 'Pick Up' | 'Delivery';
type CheckoutFormData = { name: string; whatsapp: string; orderType: OrderType; tableNumber: string; deliveryAddress: string; orderNotes: string; paymentMethod: 'CASH' | 'QRIS'; };
type Coordinates = { latitude: number; longitude: number; };
type LocationFeedback = { type: 'success' | 'warning' | 'error'; message: string; } | null;
type ReverseGeocodeResponse = { display_name?: string; };
type CartContextValue = { cart: CartItem[]; totalItems: number; totalAmount: number; addToCart: (item: MenuItem) => void; decreaseQuantity: (id: string) => void; increaseQuantity: (id: string) => void; removeFromCart: (id: string) => void; clearCart: () => void; };
type ThemeMode = 'light' | 'dark';
type ThemeContextValue = { theme: ThemeMode; toggleTheme: () => void; };
type OrderPayload = { customerName: string; tableNumber: string; totalAmount: number; paymentMethod: string; items: Array<{ menuId: string; quantity: number; price: number }>; };
type OrderStatusItem = { quantity: number; menu: { name: string; }; };
type OrderStatusResponse = { customerName?: string; createdAt: string; status: 'PENDING' | 'PENDING_PAYMENT' | 'COOKING' | 'COMPLETED' | 'CANCELLED' | string; totalAmount: number; items: OrderStatusItem[]; };

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
const CartContext = createContext<CartContextValue | undefined>(undefined);
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// --- HELPERS ---
function formatRupiah(value: number) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value); }
function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const responseMessage = (error.response?.data as { message?: string } | undefined)?.message;
    return responseMessage || error.message || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
function formatCoordinateAddress({ latitude, longitude }: Coordinates) { return `Koordinat: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`; }
async function reverseGeocodeCoordinates(coordinates: Coordinates) {
  const reverseGeocodeUrl = new URL(REVERSE_GEOCODE_URL);
  reverseGeocodeUrl.searchParams.set('format', 'jsonv2');
  reverseGeocodeUrl.searchParams.set('lat', String(coordinates.latitude));
  reverseGeocodeUrl.searchParams.set('lon', String(coordinates.longitude));
  reverseGeocodeUrl.searchParams.set('accept-language', 'id');
  const response = await fetch(reverseGeocodeUrl.toString(), { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Alamat dari lokasi belum bisa dibaca otomatis.');
  const data = (await response.json()) as ReverseGeocodeResponse;
  const readableAddress = data.display_name?.trim();
  if (!readableAddress) throw new Error('Alamat dari lokasi belum tersedia.');
  return readableAddress;
}
function getCurrentLocation() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Browser Anda belum mendukung fitur lokasi. Isi alamat secara manual.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: 0 });
  });
}
function isGeolocationError(error: unknown): error is GeolocationPositionError {
  return typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code?: unknown }).code === 'number';
}
function getLocationErrorMessage(error: unknown) {
  if (isGeolocationError(error)) {
    if (error.code === 1) return 'Izin lokasi ditolak. Anda tetap bisa mengisi alamat pengantaran secara manual.';
    if (error.code === 2) return 'GPS atau layanan lokasi belum tersedia. Aktifkan lokasi perangkat atau isi alamat manual.';
    if (error.code === 3) return 'Pengambilan lokasi melewati batas waktu. Coba lagi atau isi alamat secara manual.';
  }
  if (error instanceof Error) return error.message;
  return 'Lokasi belum bisa diambil. Isi alamat pengantaran secara manual.';
}
function buildOrderTableNumber(formData: CheckoutFormData) {
  const details: string[] = [];
  
  switch (formData.orderType) {
    case 'Makan di Tempat':
      details.push(`Makan di Tempat - ${formData.tableNumber.trim()}`);
      break;
    case 'Pick Up':
      details.push(`Pick Up`);
      break;
    case 'Delivery':
      details.push(`Delivery - ${formData.deliveryAddress.trim()}`);
      break;
    default:
      details.push(formData.orderType);
  }
  
  const orderNotes = formData.orderNotes.trim();
  if (orderNotes) details.push(`Catatan: ${orderNotes}`);
  return details.join(' | ');
}
function normalizeMenus(responseData: unknown): MenuItem[] {
  if (Array.isArray(responseData)) return responseData as MenuItem[];
  if (responseData && typeof responseData === 'object' && 'data' in responseData && Array.isArray((responseData as { data?: unknown }).data)) {
    return (responseData as { data: MenuItem[] }).data;
  }
  return [];
}
async function fetchMenus() { const { data } = await axios.get(`${API_BASE_URL}/menu`); return normalizeMenus(data); }

// --- THEME PROVIDER (SAMA DENGAN DASHBOARD) ---
function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('setiarasa-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    localStorage.setItem('setiarasa-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useTheme() { 
  const context = useContext(ThemeContext); 
  if (!context) throw new Error('useTheme must be used within ThemeProvider'); 
  return context; 
}

// --- CART PROVIDER ---
function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const addToCart = useCallback((item: MenuItem) => {
    if (!item.isAvailable || item.stock <= 0) return;
    setCart((currentCart) => {
      const existingItem = currentCart.find((cartItem) => cartItem.id === item.id);
      if (!existingItem) return [...currentCart, { ...item, quantity: 1 }];
      return currentCart.map((cartItem) => {
        if (cartItem.id !== item.id) return cartItem;
        const nextQuantity = Math.min(cartItem.quantity + 1, item.stock);
        return { ...cartItem, quantity: nextQuantity };
      });
    });
  }, []);
  const decreaseQuantity = useCallback((id: string) => {
    setCart((currentCart) => currentCart.map((item) => (item.id === id ? { ...item, quantity: item.quantity - 1 } : item)).filter((item) => item.quantity > 0));
  }, []);
  const increaseQuantity = useCallback((id: string) => {
    setCart((currentCart) => currentCart.map((item) => {
      if (item.id !== id) return item;
      return { ...item, quantity: Math.min(item.quantity + 1, item.stock) };
    }));
  }, []);
  const removeFromCart = useCallback((id: string) => { setCart((currentCart) => currentCart.filter((item) => item.id !== id)); }, []);
  const clearCart = useCallback(() => { setCart([]); }, []);
  const value = useMemo<CartContextValue>(() => {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return { cart, totalItems, totalAmount, addToCart, decreaseQuantity, increaseQuantity, removeFromCart, clearCart };
  }, [addToCart, cart, clearCart, decreaseQuantity, increaseQuantity, removeFromCart]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

function useCart() { const context = useContext(CartContext); if (!context) throw new Error('useCart must be used within CartProvider'); return context; }

// --- COMPONENTS ---
function BrandLogo() {
  const [logoFailed, setLogoFailed] = useState(false);
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border-2 border-[#18181B] bg-[#7F1D1D] text-sm font-black tracking-wide text-[#FFFDF7] shadow-[3px_3px_0px_#18181B] dark:border-[#FFFDF7] dark:shadow-[3px_3px_0px_#FFFDF7]">
      {logoFailed ? 'SR' : <img src={LOGO_IMAGE_URL} alt="Logo Setia Rasa" className="h-full w-full object-contain" onError={() => setLogoFailed(true)} />}
    </span>
  );
}

function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string; }) {
  return (
    <div className="mb-10">
      <p className="text-sm font-black uppercase tracking-wide text-[#7F1D1D] dark:text-[#C9A227]">{eyebrow}</p>
      <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-tight text-[#18181B] sm:text-4xl dark:text-[#FFFDF7]">{title}</h1>
      <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-[#18181B]/70 sm:text-base dark:text-[#FFFDF7]/70">{description}</p>
    </div>
  );
}

function InfoCard({ icon, title, description }: { icon: ReactNode; title: string; description: string; }) {
  return (
    <div className="border-4 border-[#18181B] bg-[#FFFDF7] p-6 shadow-[8px_8px_0px_#18181B] transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[12px_12px_0px_#18181B] dark:border-[#FFFDF7] dark:bg-[#18181B] dark:shadow-[8px_8px_0px_#FFFDF7] dark:hover:shadow-[12px_12px_0px_#FFFDF7]">
      <div className="flex h-11 w-11 items-center justify-center border-2 border-[#18181B] bg-[#C9A227] shadow-[3px_3px_0px_#18181B] dark:border-[#FFFDF7] dark:shadow-[3px_3px_0px_#FFFDF7]">
        {icon}
      </div>
      <h2 className="mt-5 text-lg font-black text-[#18181B] dark:text-[#FFFDF7]">{title}</h2>
      <p className="mt-2 text-sm font-bold leading-6 text-[#18181B]/70 dark:text-[#FFFDF7]/70">{description}</p>
    </div>
  );
}

function ContactRow({ icon, label, value }: { icon: ReactNode; label: string; value: string; }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-[#18181B] bg-[#C9A227] shadow-[3px_3px_0px_#18181B] dark:border-[#FFFDF7] dark:shadow-[3px_3px_0px_#FFFDF7]">
        {icon}
      </div>
      <div>
        <p className="text-sm font-black text-[#18181B] dark:text-[#FFFDF7]">{label}</p>
        <p className="mt-1 text-sm font-bold leading-6 text-[#18181B]/70 dark:text-[#FFFDF7]/70">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ title, description, compact = false }: { title: string; description: string; compact?: boolean; }) {
  return (
    <div className={`border-4 border-[#18181B] bg-[#FFFDF7] p-8 text-center shadow-[8px_8px_0px_#18181B] dark:border-[#FFFDF7] dark:bg-[#18181B] dark:shadow-[8px_8px_0px_#FFFDF7] ${compact ? 'mt-6 px-4 py-8' : ''}`}>
      <div className="mx-auto flex h-12 w-12 items-center justify-center border-2 border-[#18181B] bg-[#C9A227] shadow-[3px_3px_0px_#18181B] dark:border-[#FFFDF7] dark:shadow-[3px_3px_0px_#FFFDF7]">
        <ShoppingBag className="h-5 w-5 text-[#18181B]" />
      </div>
      <h3 className="mt-4 text-base font-black text-[#18181B] dark:text-[#FFFDF7]">{title}</h3>
      <p className="mt-2 text-sm font-bold leading-6 text-[#18181B]/70 dark:text-[#FFFDF7]/70">{description}</p>
    </div>
  );
}

// --- NAVBAR ---
function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [mobileMenu, setMobileMenu] = useState({ isOpen: false, pathname: location.pathname });
  const isOpen = mobileMenu.isOpen && mobileMenu.pathname === location.pathname;
  
  const navItems = [
    { to: '/', label: 'Beranda' },
    { to: '/menu', label: 'Menu' },
    { to: '/status', label: 'Cek Pesanan' },
    { to: '/tentang', label: 'Tentang' },
    { to: '/kontak', label: 'Kontak' },
  ];
  const mobileNavItems = [...navItems, { to: '/pesan', label: 'Pesan Sekarang' }];

  const closeMobileMenu = () => setMobileMenu({ isOpen: false, pathname: location.pathname });
  const toggleMobileMenu = () => setMobileMenu((current) => ({ isOpen: current.pathname === location.pathname ? !current.isOpen : true, pathname: location.pathname }));

  useEffect(() => {
    if (!isOpen) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = originalOverflow; };
  }, [isOpen]);

  return (
    <header className="sticky top-0 z-50 border-b-4 border-[#18181B] bg-[#FFFDF7] dark:border-[#FFFDF7] dark:bg-[#18181B] transition-colors duration-300">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3" onClick={closeMobileMenu}>
          <BrandLogo />
          <span className="text-xl font-black tracking-tight text-[#18181B] dark:text-[#FFFDF7]">Setia Rasa</span>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `px-4 py-2.5 text-sm font-black transition-all duration-200 ${
                  isActive
                    ? 'bg-[#7F1D1D] text-[#FFFDF7] border-2 border-[#18181B] shadow-[4px_4px_0px_#18181B] dark:border-[#FFFDF7] dark:shadow-[4px_4px_0px_#FFFDF7]'
                    : 'text-[#18181B] hover:bg-[#C9A227]/20 border-2 border-transparent dark:text-[#FFFDF7] dark:hover:bg-[#C9A227]/20'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={ADMIN_LOGIN_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1 border-2 border-[#18181B] px-3 py-2 text-xs font-black text-[#18181B] transition-colors hover:bg-[#18181B] hover:text-[#FFFDF7] dark:border-[#FFFDF7] dark:text-[#FFFDF7] dark:hover:bg-[#FFFDF7] dark:hover:text-[#18181B] sm:flex"
          >
            Login Admin <ExternalLink className="h-3.5 w-3.5" />
          </a>

          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center border-2 border-[#18181B] bg-[#FFFDF7] shadow-[4px_4px_0px_#18181B] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#18181B] dark:border-[#FFFDF7] dark:bg-[#18181B] dark:shadow-[4px_4px_0px_#FFFDF7] dark:hover:shadow-[6px_6px_0px_#FFFDF7]"
            aria-label={theme === 'dark' ? 'Aktifkan Light Mode' : 'Aktifkan Dark Mode'}
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-[#C9A227]" />
            ) : (
              <Moon className="h-4 w-4 text-[#18181B]" />
            )}
          </button>

          <button
            type="button"
            onClick={toggleMobileMenu}
            className="flex h-10 w-10 items-center justify-center border-2 border-[#18181B] bg-[#FFFDF7] shadow-[4px_4px_0px_#18181B] md:hidden dark:border-[#FFFDF7] dark:bg-[#18181B] dark:shadow-[4px_4px_0px_#FFFDF7]"
          >
            {isOpen ? <X className="h-5 w-5 text-[#18181B] dark:text-[#FFFDF7]" /> : <MenuIcon className="h-5 w-5 text-[#18181B] dark:text-[#FFFDF7]" />}
          </button>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-40 bg-[#18181B]/80 transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={closeMobileMenu}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-dvh w-[min(22rem,calc(100vw-1.5rem))] flex-col border-l-4 border-[#18181B] bg-[#FFFDF7] shadow-[-8px_0_0px_#18181B] transition-transform duration-300 ease-out dark:border-[#FFFDF7] dark:bg-[#18181B] dark:shadow-[-8px_0_0px_#FFFDF7] md:hidden ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between border-b-4 border-[#18181B] px-4 py-4 dark:border-[#FFFDF7]">
          <Link to="/" className="flex items-center gap-3" onClick={closeMobileMenu}>
            <BrandLogo />
            <span className="text-xl font-black tracking-tight text-[#18181B] dark:text-[#FFFDF7]">Setia Rasa</span>
          </Link>
          <button
            type="button"
            onClick={closeMobileMenu}
            className="flex h-10 w-10 items-center justify-center border-2 border-[#18181B] bg-[#FFFDF7] shadow-[4px_4px_0px_#18181B] dark:border-[#FFFDF7] dark:bg-[#18181B] dark:shadow-[4px_4px_0px_#FFFDF7]"
          >
            <X className="h-5 w-5 text-[#18181B] dark:text-[#FFFDF7]" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-2 px-4 py-6">
          {mobileNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-between border-2 px-4 py-3 text-sm font-black transition-all dark:border-[#FFFDF7] ${
                  isActive
                    ? 'bg-[#7F1D1D] text-[#FFFDF7] border-[#18181B] shadow-[4px_4px_0px_#18181B] dark:shadow-[4px_4px_0px_#FFFDF7]'
                    : 'border-transparent text-[#18181B] hover:bg-[#C9A227]/20 dark:text-[#FFFDF7]'
                }`
              }
              onClick={closeMobileMenu}
            >
              {item.label} <ChevronRight className="h-4 w-4" />
            </NavLink>
          ))}
          <a
            href={ADMIN_LOGIN_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-auto flex items-center justify-center gap-2 border-2 border-[#18181B] px-4 py-3 text-sm font-black text-[#18181B] transition-colors hover:bg-[#18181B] hover:text-[#FFFDF7] dark:border-[#FFFDF7] dark:text-[#FFFDF7] dark:hover:bg-[#FFFDF7] dark:hover:text-[#18181B]"
          >
            Login Admin <ExternalLink className="h-4 w-4" />
          </a>
        </nav>
      </aside>
    </header>
  );
}

// --- FLOATING CART ---
function FloatingCartButton() {
  const { totalItems } = useCart();
  const location = useLocation();
  const [footerOffset, setFooterOffset] = useState(0);
  const shouldHide = location.pathname === '/pesan';

  useEffect(() => {
    if (shouldHide) return;
    const footer = document.querySelector<HTMLElement>('[data-app-footer]');
    if (!footer) return;
    let animationFrame = 0;
    const updateFooterOffset = () => {
      animationFrame = 0;
      const nextOffset = Math.max(0, Math.ceil(window.innerHeight - footer.getBoundingClientRect().top));
      setFooterOffset((currentOffset) => (currentOffset === nextOffset ? currentOffset : nextOffset));
    };
    const requestOffsetUpdate = () => { if (animationFrame) return; animationFrame = window.requestAnimationFrame(updateFooterOffset); };
    requestOffsetUpdate();
    window.addEventListener('scroll', requestOffsetUpdate, { passive: true });
    window.addEventListener('resize', requestOffsetUpdate);
    return () => { if (animationFrame) window.cancelAnimationFrame(animationFrame); window.removeEventListener('scroll', requestOffsetUpdate); window.removeEventListener('resize', requestOffsetUpdate); };
  }, [shouldHide]);

  if (shouldHide) return null;

  return (
    <Link
      to="/pesan"
      className="fixed z-30 flex h-16 w-16 items-center justify-center bg-[#7F1D1D] text-[#FFFDF7] border-4 border-[#18181B] shadow-[8px_8px_0px_#18181B] transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[12px_12px_0px_#18181B] active:translate-x-1 active:translate-y-1 active:shadow-[4px_4px_0px_#18181B] dark:border-[#FFFDF7] dark:shadow-[8px_8px_0px_#FFFDF7] dark:hover:shadow-[12px_12px_0px_#FFFDF7] dark:active:shadow-[4px_4px_0px_#FFFDF7]"
      style={{ bottom: `calc(${24 + footerOffset}px + env(safe-area-inset-bottom))`, right: 'calc(1.5rem + env(safe-area-inset-right))' }}
    >
      <ShoppingBag className="h-6 w-6" />
      {totalItems > 0 && (
        <span className="absolute -right-2 -top-2 flex min-h-6 min-w-6 items-center justify-center bg-[#C9A227] px-1.5 text-xs font-black leading-none text-[#18181B] border-2 border-[#18181B] shadow-[3px_3px_0px_#18181B]">
          {totalItems}
        </span>
      )}
    </Link>
  );
}

// --- FOOTER ---
function Footer() {
  return (
    <footer data-app-footer className="border-t-4 border-[#18181B] bg-[#FFFDF7] transition-colors dark:border-[#FFFDF7] dark:bg-[#18181B]">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 text-[#18181B]/70 dark:text-[#FFFDF7]/70">
        <div className="flex items-center gap-3">
          <BrandLogo />
          <div>
            <p className="font-black text-[#18181B] dark:text-[#FFFDF7]">Setia Rasa</p>
            <p>{CONTACT_INFO.openingHours}</p>
          </div>
        </div>
        <p className="max-w-xl font-bold sm:text-right">{CONTACT_INFO.address}</p>
      </div>
    </footer>
  );
}

// --- HOMEPAGE ---
function HomePage() {
  return (
    <section className="border-b-4 border-[#18181B] bg-[#FFFDF7] dark:border-[#FFFDF7] dark:bg-[#18181B] transition-colors duration-300">
      <div className="mx-auto grid min-h-[calc(100vh-72px)] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:py-24">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 border-2 border-[#18181B] bg-[#C9A227] px-4 py-2 text-sm font-black text-[#18181B] shadow-[4px_4px_0px_#18181B] dark:border-[#FFFDF7] dark:shadow-[4px_4px_0px_#FFFDF7]">
            <ShieldCheck className="h-4 w-4" /> 100% HALAL
          </div>
          <h1 className="max-w-4xl text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl text-[#18181B] dark:text-[#FFFDF7]">
            CITA RASA OTENTIK, <br /><span className="text-[#7F1D1D] dark:text-[#C9A227]">DIBUAT SEPENUH HATI</span>
          </h1>
          <p className="max-w-2xl text-base leading-8 sm:text-lg text-[#18181B]/70 dark:text-[#FFFDF7]/70">
            Setia Rasa menyajikan hidangan rumahan Indonesia dengan bahan segar, proses bersih, dan pelayanan yang cepat.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link to="/menu" className="flex items-center justify-center gap-2 bg-[#7F1D1D] px-6 py-3.5 text-sm font-black text-[#FFFDF7] border-4 border-[#18181B] shadow-[6px_6px_0px_#18181B] transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[10px_10px_0px_#18181B] dark:border-[#FFFDF7] dark:shadow-[6px_6px_0px_#FFFDF7] dark:hover:shadow-[10px_10px_0px_#FFFDF7]">
              Lihat Menu <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/kontak" className="flex items-center justify-center gap-2 bg-[#FFFDF7] px-6 py-3.5 text-sm font-black text-[#18181B] border-4 border-[#18181B] shadow-[6px_6px_0px_#18181B] transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[10px_10px_0px_#18181B] dark:bg-[#18181B] dark:text-[#FFFDF7] dark:border-[#FFFDF7] dark:shadow-[6px_6px_0px_#FFFDF7] dark:hover:shadow-[10px_10px_0px_#FFFDF7]">
              Hubungi Kami <Phone className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <InfoCard icon={<Utensils className="h-5 w-5" />} title="Menu Harian" description="Pilihan makanan utama, camilan, dan minuman disiapkan setiap hari." />
          <InfoCard icon={<Clock3 className="h-5 w-5" />} title="Layanan Cepat" description="Pesanan online langsung masuk ke dapur untuk diproses lebih efisien." />
          <InfoCard icon={<MapPin className="h-5 w-5" />} title="Lokasi Nyaman" description="Datang langsung atau pilih pick up saat sedang terburu-buru." />
          <InfoCard icon={<ShoppingBag className="h-5 w-5" />} title="Checkout Mudah" description="Pilih menu, isi data, dan kirim pesanan hanya dalam beberapa langkah." />
        </div>
      </div>
    </section>
  );
}

// --- MENU PAGE ---
function MenuPage() {
  const { addToCart, cart } = useCart();
  const [searchQuery, setSearchQuery] = useState('');
  const { data: menus = [], error, isError, isLoading, refetch, isFetching } = useQuery({ queryKey: ['public-menu'], queryFn: fetchMenus });

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredMenus = useMemo(() => {
    if (!normalizedSearchQuery) return menus;
    return menus.filter((menu) => {
      const name = menu.name.toLowerCase();
      const description = (menu.description || '').toLowerCase();
      return name.includes(normalizedSearchQuery) || description.includes(normalizedSearchQuery);
    });
  }, [menus, normalizedSearchQuery]);

  const groupedMenus = useMemo(() => {
    return filteredMenus.reduce<Record<string, MenuItem[]>>((groups, menu) => {
      const category = menu.category?.trim() || 'Lainnya';
      return { ...groups, [category]: [...(groups[category] || []), menu] };
    }, {});
  }, [filteredMenus]);

  const categories = Object.keys(groupedMenus);
  const hasSearchQuery = normalizedSearchQuery.length > 0;

  return (
    <section className="bg-[#FFFDF7] px-4 py-16 transition-colors dark:bg-[#18181B] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader eyebrow="Katalog Menu" title="PILIH HIDANGAN" description="Menu dikelompokkan berdasarkan kategori agar pelanggan mudah memilih." />

        <div className="mb-10 border-4 border-[#18181B] bg-[#FFFDF7] p-6 shadow-[8px_8px_0px_#18181B] dark:border-[#FFFDF7] dark:bg-[#18181B] dark:shadow-[8px_8px_0px_#FFFDF7]">
          <label htmlFor="menu-search" className="text-sm font-black text-[#18181B] dark:text-[#FFFDF7]">Cari Menu</label>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A227]" />
            <input
              id="menu-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              disabled={isLoading || isError}
              placeholder="Cari nama atau deskripsi menu..."
              className="w-full border-2 border-[#18181B] bg-[#FFFDF7] px-4 py-3.5 pl-11 pr-4 text-sm font-medium text-[#18181B] outline-none transition-all focus:shadow-[4px_4px_0px_#7F1D1D] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#FFFDF7] dark:bg-[#18181B] dark:text-[#FFFDF7] dark:focus:shadow-[4px_4px_0px_#C9A227] dark:disabled:text-[#FFFDF7]/60"
            />
          </div>
          <p className="mt-2 text-xs font-bold text-[#18181B]/70 dark:text-[#FFFDF7]/70">{hasSearchQuery ? `${filteredMenus.length} menu cocok dengan pencarian Anda.` : 'Cari berdasarkan nama menu atau deskripsi hidangan.'}</p>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="border-4 border-[#18181B] bg-[#FFFDF7] p-6 shadow-[8px_8px_0px_#18181B] animate-pulse dark:border-[#FFFDF7] dark:bg-[#18181B] dark:shadow-[8px_8px_0px_#FFFDF7]">
                <div className="h-48 bg-[#E7D9B8]/30 dark:bg-[#C9A227]/10"></div>
                <div className="mt-4 h-6 w-3/4 bg-[#E7D9B8]/30 dark:bg-[#C9A227]/10"></div>
                <div className="mt-2 h-4 w-1/2 bg-[#E7D9B8]/30 dark:bg-[#C9A227]/10"></div>
                <div className="mt-4 h-10 w-full bg-[#E7D9B8]/30 dark:bg-[#C9A227]/10"></div>
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="border-4 border-[#18181B] bg-[#FFFDF7] p-8 text-center shadow-[8px_8px_0px_#18181B] dark:border-[#FFFDF7] dark:bg-[#18181B] dark:shadow-[8px_8px_0px_#FFFDF7]">
            <h3 className="text-base font-black text-[#18181B] dark:text-[#FFFDF7]">Menu belum dapat dimuat</h3>
            <p className="mt-2 text-sm font-bold text-[#18181B]/70 dark:text-[#FFFDF7]/70">{getErrorMessage(error, 'Backend tidak merespons.')}</p>
            <button type="button" onClick={() => void refetch()} className="mt-6 inline-flex items-center justify-center gap-2 bg-[#7F1D1D] px-6 py-3 text-sm font-black text-[#FFFDF7] border-4 border-[#18181B] shadow-[6px_6px_0px_#18181B] transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[10px_10px_0px_#18181B] dark:border-[#FFFDF7] dark:shadow-[6px_6px_0px_#FFFDF7] dark:hover:shadow-[10px_10px_0px_#FFFDF7]">
              {isFetching && <Loader2 className="h-4 w-4 animate-spin" />} Coba Lagi
            </button>
          </div>
        )}

        {!isLoading && !isError && categories.length === 0 && (
          <EmptyState title={hasSearchQuery ? 'Menu tidak ditemukan' : 'Menu belum tersedia'} description={hasSearchQuery ? 'Coba gunakan kata kunci lain.' : 'Belum ada data menu dari server.'} />
        )}

        {!isLoading && !isError && categories.length > 0 && (
          <div className="space-y-14">
            {categories.map((category) => (
              <div key={category}>
                <div className="mb-6 flex items-center gap-4">
                  <h2 className="text-2xl font-black text-[#18181B] dark:text-[#FFFDF7]">{category}</h2>
                  <div className="h-1 flex-1 bg-[#18181B] dark:bg-[#FFFDF7]" />
                </div>
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {groupedMenus[category].map((menu) => {
                    const isOutOfStock = !menu.isAvailable || menu.stock <= 0;
                    const cartItem = cart.find((item) => item.id === menu.id);
                    return (
                      <article key={menu.id} className="group flex flex-col overflow-hidden border-4 border-[#18181B] bg-[#FFFDF7] shadow-[8px_8px_0px_#18181B] transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[12px_12px_0px_#18181B] dark:border-[#FFFDF7] dark:bg-[#18181B] dark:shadow-[8px_8px_0px_#FFFDF7] dark:hover:shadow-[12px_12px_0px_#FFFDF7]">
                        <div className="relative aspect-[4/3] bg-[#C9A227]/10 overflow-hidden">
                          <img src={menu.imageUrl || PLACEHOLDER_IMAGE} alt={menu.name} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.src = PLACEHOLDER_IMAGE; }} />
                          {isOutOfStock && (
                            <div className="absolute inset-0 flex items-center justify-center bg-[#18181B]/80">
                              <span className="px-4 py-2 text-sm font-black tracking-widest bg-[#7F1D1D] text-[#FFFDF7] border-2 border-[#18181B] shadow-[4px_4px_0px_#18181B]">HABIS</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col p-5">
                          <h3 className="line-clamp-2 text-lg font-black text-[#18181B] dark:text-[#FFFDF7]">{menu.name}</h3>
                          {menu.description && <p className="mt-2 line-clamp-2 text-sm font-bold leading-6 text-[#18181B]/70 dark:text-[#FFFDF7]/70">{menu.description}</p>}
                          <div className="mt-4 flex items-center justify-between border-t-2 border-[#18181B] pt-4 dark:border-[#FFFDF7]">
                            <p className="text-lg font-black text-[#7F1D1D] dark:text-[#C9A227]">{formatRupiah(menu.price)}</p>
                            {isOutOfStock ? (
                              <span className="bg-[#7F1D1D]/10 px-3 py-1.5 text-xs font-bold text-[#7F1D1D] border-2 border-[#7F1D1D] dark:bg-[#7F1D1D]/30 dark:text-[#FFFDF7] dark:border-[#C9A227]">Habis</span>
                            ) : (
                              <button type="button" onClick={() => addToCart(menu)} className="inline-flex items-center justify-center gap-1.5 bg-[#7F1D1D] px-4 py-2 text-xs font-black text-[#FFFDF7] border-2 border-[#18181B] shadow-[4px_4px_0px_#18181B] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#18181B] dark:border-[#FFFDF7] dark:shadow-[4px_4px_0px_#FFFDF7] dark:hover:shadow-[6px_6px_0px_#FFFDF7]">
                                <Plus className="h-3.5 w-3.5" /> {cartItem ? `Tambah (${cartItem.quantity})` : 'Tambah'}
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// --- ABOUT PAGE ---
function AboutPage() {
  return (
    <section className="bg-[#FFFDF7] px-4 py-16 transition-colors dark:bg-[#18181B] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader eyebrow="Tentang Setia Rasa" title="RESTORAN KELUARGA" description="Kami menggabungkan resep otentik, bahan berkualitas, dan alur pemesanan digital agar pelanggan mendapatkan pengalaman yang rapi dan konsisten." />
        <div className="grid gap-6 md:grid-cols-3">
          <InfoCard icon={<Utensils className="h-5 w-5" />} title="Resep Otentik" description="Setiap menu diracik dengan bumbu khas Indonesia dan rasa yang familiar untuk seluruh keluarga." />
          <InfoCard icon={<ShieldCheck className="h-5 w-5" />} title="Bersih dan Halal" description="Proses dapur dijaga dengan standar kebersihan yang konsisten dan seluruh bahan dipilih secara cermat." />
          <InfoCard icon={<ShoppingBag className="h-5 w-5" />} title="Mudah Dipesan" description="Pelanggan bisa memesan untuk makan di tempat, pick up, atau delivery langsung dari aplikasi publik ini." />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="border-4 border-[#18181B] bg-[#FFFDF7] p-6 shadow-[8px_8px_0px_#18181B] dark:border-[#FFFDF7] dark:bg-[#18181B] dark:shadow-[8px_8px_0px_#FFFDF7]">
            <h2 className="text-xl font-black text-[#18181B] dark:text-[#FFFDF7]">Komitmen Kami</h2>
            <p className="mt-3 text-sm font-bold leading-8 text-[#18181B]/70 dark:text-[#FFFDF7]/70">Setia Rasa hadir untuk menjaga rasa masakan rumahan tetap dekat dengan pelanggan. Kami percaya makanan yang baik lahir dari bahan segar, proses yang tertata, dan pelayanan yang menghargai waktu pelanggan.</p>
          </div>
          <div className="border-4 border-[#18181B] bg-[#FFFDF7] p-6 shadow-[8px_8px_0px_#18181B] dark:border-[#FFFDF7] dark:bg-[#18181B] dark:shadow-[8px_8px_0px_#FFFDF7]">
            <h2 className="text-xl font-black text-[#18181B] dark:text-[#FFFDF7]">Informasi Singkat</h2>
            <div className="mt-4 space-y-4">
              <ContactRow icon={<MapPin className="h-5 w-5" />} label="Alamat" value={CONTACT_INFO.address} />
              <ContactRow icon={<Clock3 className="h-5 w-5" />} label="Jam Buka" value={CONTACT_INFO.openingHours} />
              <ContactRow icon={<Phone className="h-5 w-5" />} label="WhatsApp" value={CONTACT_INFO.whatsapp} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// --- CONTACT PAGE ---
function ContactPage() {
  return (
    <section className="bg-[#FFFDF7] px-4 py-16 transition-colors dark:bg-[#18181B] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader eyebrow="Kontak" title="KUNJUNGI KAMI" description="Kami tunggu kedatangan Anda untuk mencicipi langsung kelezatan menu kami. Pesan antar juga tersedia!" />
        <div className="grid gap-6 md:grid-cols-3">
          <InfoCard icon={<MapPin className="h-5 w-5" />} title="Alamat" description={CONTACT_INFO.address} />
          <InfoCard icon={<Clock3 className="h-5 w-5" />} title="Jam Buka" description={CONTACT_INFO.openingHours} />
          <InfoCard icon={<Phone className="h-5 w-5" />} title="WhatsApp" description={`${CONTACT_INFO.whatsapp} untuk konfirmasi pesanan, pick up, dan delivery.`} />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="border-4 border-[#18181B] bg-[#FFFDF7] p-6 shadow-[8px_8px_0px_#18181B] dark:border-[#FFFDF7] dark:bg-[#18181B] dark:shadow-[8px_8px_0px_#FFFDF7]">
            <h2 className="text-xl font-black text-[#18181B] dark:text-[#FFFDF7]">Butuh bantuan cepat?</h2>
            <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-[#18181B]/70 dark:text-[#FFFDF7]/70">Untuk perubahan pesanan setelah checkout, hubungi tim kami melalui WhatsApp agar dapur bisa menyesuaikan pesanan sebelum diproses.</p>
            <a href={CONTACT_INFO.whatsappUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center justify-center gap-2 bg-[#7F1D1D] px-5 py-3 text-sm font-black text-[#FFFDF7] border-4 border-[#18181B] shadow-[6px_6px_0px_#18181B] transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[10px_10px_0px_#18181B] dark:border-[#FFFDF7] dark:shadow-[6px_6px_0px_#FFFDF7] dark:hover:shadow-[10px_10px_0px_#FFFDF7]">Chat WhatsApp <ExternalLink className="h-4 w-4" /></a>
          </div>
          <div className="overflow-hidden border-4 border-[#18181B] bg-[#FFFDF7] shadow-[8px_8px_0px_#18181B] dark:border-[#FFFDF7] dark:bg-[#18181B] dark:shadow-[8px_8px_0px_#FFFDF7]">
            <iframe title="Lokasi RM Setia Rasa" src={MAPS_EMBED_URL} className="h-[320px] w-full border-0" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
          </div>
        </div>
      </div>
    </section>
  );
}

// --- CHECKOUT PAGE ---
function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, totalItems, totalAmount, decreaseQuantity, increaseQuantity, removeFromCart, clearCart } = useCart();
  const [formData, setFormData] = useState<CheckoutFormData>({
    name: '', whatsapp: '', orderType: 'Makan di Tempat', tableNumber: '', deliveryAddress: '', orderNotes: '', paymentMethod: 'QRIS',
  });
  const [submitError, setSubmitError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'pending' | 'cash_pending'>('success');
  const [isLocating, setIsLocating] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState<LocationFeedback>(null);
  const isDineIn = formData.orderType === 'Makan di Tempat';
  const isDelivery = formData.orderType === 'Delivery';
  const remainingOrderNoteCharacters = ORDER_NOTES_MAX_LENGTH - formData.orderNotes.length;

  const orderMutation = useMutation({
  mutationFn: (payload: OrderPayload) => axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/public/orders`, {
    ...payload,
    status: 'PENDING_PAYMENT'
  }),
    onSuccess: async (res, variables) => {
      const order = res.data.data;
      if (variables.paymentMethod === 'CASH') {
        setCreatedOrderId(order.id);
        setPaymentStatus('cash_pending');
        setIsSuccess(true);
        clearCart();
        return;
      }
      try {
        const payRes = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/payments/create`, {
          orderId: order.id, amount: order.totalAmount, customerName: order.customerName,
        });
        const { token } = payRes.data;
        // @ts-ignore
        window.snap.pay(token, {
          onSuccess: () => { setCreatedOrderId(order.id); setPaymentStatus('success'); setIsSuccess(true); clearCart(); },
          onPending: () => { setCreatedOrderId(order.id); setPaymentStatus('pending'); setIsSuccess(true); clearCart(); },
          onError: () => { alert('Pembayaran gagal, silakan coba lagi.'); },
          onClose: () => { alert('Anda menutup layar pembayaran sebelum selesai.'); },
        });
      } catch (err) {
        console.error('Gagal memuat Midtrans:', err);
        alert('Gagal membuka halaman pembayaran.');
      }
    },
    onError: () => alert('Gagal memproses pesanan. Pastikan stok tersedia.'),
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    const fieldName = name as keyof CheckoutFormData;
    const nextValue = fieldName === 'orderNotes' ? value.slice(0, ORDER_NOTES_MAX_LENGTH) : value;
    setFormData((current) => ({
      ...current,
      [fieldName]: fieldName === 'orderType' ? (nextValue as OrderType) : nextValue,
      ...(fieldName === 'orderType' && nextValue === 'Delivery' ? { paymentMethod: 'QRIS' } : {}),
    }));
    if (fieldName === 'orderType') { setSubmitError(''); setLocationFeedback(null); }
  };

  const setPaymentMethod = (method: 'CASH' | 'QRIS') => {
    if (isDelivery && method === 'CASH') return;
    setFormData((current) => ({ ...current, paymentMethod: method }));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(createdOrderId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleUseCurrentLocation = async () => {
    if (!isDelivery) return;
    setSubmitError(''); setLocationFeedback(null); setIsLocating(true);
    try {
      const position = await getCurrentLocation();
      const coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      const coordinateAddress = formatCoordinateAddress(coordinates);
      try {
        const readableAddress = await reverseGeocodeCoordinates(coordinates);
        setFormData((current) => ({ ...current, deliveryAddress: readableAddress }));
        setLocationFeedback({ type: 'success', message: 'Lokasi berhasil digunakan. Alamat tetap bisa diedit sebelum pesanan dikirim.' });
      } catch {
        setFormData((current) => ({ ...current, deliveryAddress: coordinateAddress }));
        setLocationFeedback({ type: 'warning', message: 'Lokasi berhasil diambil, tetapi alamat belum bisa dibaca otomatis. Lengkapi alamat atau patokan secara manual.' });
      }
    } catch (error) {
      setLocationFeedback({ type: 'error', message: getLocationErrorMessage(error) });
    } finally { setIsLocating(false); }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError('');
    if (cart.length === 0) { setSubmitError('Keranjang masih kosong. Tambahkan menu terlebih dahulu.'); return; }
    if (isDineIn && !formData.tableNumber.trim()) { setSubmitError('Nomor meja wajib diisi untuk pesanan Makan di Tempat.'); return; }
    if (isDelivery && !formData.deliveryAddress.trim()) { setSubmitError('Alamat pengantaran wajib diisi untuk pesanan Delivery.'); return; }
    const tableNumber = buildOrderTableNumber(formData);
    const payload: OrderPayload = {
      customerName: `${formData.name.trim()} - WA: ${formData.whatsapp.trim()}`,
      tableNumber, totalAmount, paymentMethod: formData.paymentMethod,
      items: cart.map((item) => ({ menuId: item.id, quantity: item.quantity, price: item.price })),
    };
    orderMutation.mutate(payload);
  };

  if (isSuccess) return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center bg-[#FFFDF7] px-4 dark:bg-[#18181B]">
      <div className="w-full max-w-md space-y-4 border-4 border-[#18181B] bg-[#FFFDF7] p-8 text-center shadow-[8px_8px_0px_#18181B] dark:border-[#FFFDF7] dark:bg-[#18181B] dark:shadow-[8px_8px_0px_#FFFDF7]">
        <CheckCircle className="mx-auto h-16 w-16 text-[#065F46] dark:text-[#34D399]" />
        <h2 className="text-2xl font-black text-[#18181B] dark:text-[#FFFDF7]">
          {paymentStatus === 'success' ? 'Pesanan Diterima!' : paymentStatus === 'cash_pending' ? 'Silakan Bayar di Kasir' : 'Menunggu Pembayaran...'}
        </h2>
        <p className="text-sm font-bold text-[#18181B]/70 dark:text-[#FFFDF7]/70">
          {paymentStatus === 'success' ? <>Pesanan atas nama <strong className="dark:text-[#FFFDF7]">{formData.name}</strong> sedang diteruskan ke dapur.</> : paymentStatus === 'cash_pending' ? <>Pesanan tercatat. Datang ke kasir dan sebutkan nama <strong className="dark:text-[#FFFDF7]">{formData.name}</strong> atau ID pesanan untuk membayar tunai.</> : <>Silakan selesaikan pembayaran. Dapur akan memproses pesanan setelah pembayaran terkonfirmasi lunas.</>}
        </p>
        <div className="mt-6 border-2 border-[#18181B] bg-[#FFFDF7] p-4 shadow-[4px_4px_0px_#18181B] dark:border-[#FFFDF7] dark:bg-[#18181B] dark:shadow-[4px_4px_0px_#FFFDF7]">
          <p className="mb-2 text-xs font-black uppercase tracking-wider text-[#18181B]/50 dark:text-[#FFFDF7]/50">ID Pesanan Anda</p>
          <div className="flex items-center justify-between border-2 border-[#18181B] bg-[#FFFDF7] p-2 dark:border-[#FFFDF7] dark:bg-[#18181B]">
            <p className="truncate pl-2 font-mono text-sm font-black text-[#18181B] dark:text-[#FFFDF7]">{createdOrderId}</p>
            <button onClick={handleCopy} className={`ml-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-black transition-all ${isCopied ? 'bg-[#065F46] text-[#FFFDF7] dark:bg-[#34D399] dark:text-[#18181B]' : 'border-2 border-[#18181B] bg-[#FFFDF7] text-[#18181B] shadow-[3px_3px_0px_#18181B] dark:border-[#FFFDF7] dark:bg-[#18181B] dark:text-[#FFFDF7] dark:shadow-[3px_3px_0px_#FFFDF7]'}`}>
              {isCopied ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {isCopied ? 'Disalin' : 'Salin'}
            </button>
          </div>
          <p className="mt-3 text-xs font-bold text-[#7F1D1D] dark:text-[#C9A227]">*Salin dan simpan ID ini untuk melacak status pesanan Anda.</p>
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={() => navigate('/status')} className="w-full border-2 border-[#18181B] bg-[#FFFDF7] py-2.5 text-sm font-black text-[#18181B] shadow-[4px_4px_0px_#18181B] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#18181B] dark:border-[#FFFDF7] dark:bg-[#18181B] dark:text-[#FFFDF7] dark:shadow-[4px_4px_0px_#FFFDF7] dark:hover:shadow-[6px_6px_0px_#FFFDF7]">Lacak Pesanan</button>
          <button onClick={() => { setIsSuccess(false); navigate('/menu'); }} className="w-full bg-[#7F1D1D] py-2.5 text-sm font-black text-[#FFFDF7] border-4 border-[#18181B] shadow-[6px_6px_0px_#18181B] transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[10px_10px_0px_#18181B] dark:border-[#FFFDF7] dark:shadow-[6px_6px_0px_#FFFDF7] dark:hover:shadow-[10px_10px_0px_#FFFDF7]">Pesan Lagi</button>
        </div>
      </div>
    </div>
  );

  return (
    <section className="bg-[#FFFDF7] px-4 py-16 transition-colors dark:bg-[#18181B] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader eyebrow="Checkout" title="LENGKAPI PESANAN" description="Isi data pelanggan, pilih tipe pesanan, lalu cek kembali ringkasan keranjang sebelum dikirim ke restoran." />
        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <form onSubmit={handleSubmit} className="border-4 border-[#18181B] bg-[#FFFDF7] p-6 shadow-[8px_8px_0px_#18181B] dark:border-[#FFFDF7] dark:bg-[#18181B] dark:shadow-[8px_8px_0px_#FFFDF7]">
            <h2 className="text-lg font-black text-[#18181B] dark:text-[#FFFDF7]">Data Pelanggan</h2>
            <div className="mt-6 grid gap-5">
              <label className="block"><span className="text-sm font-black text-[#18181B] dark:text-[#FFFDF7]">Nama Lengkap</span><input required name="name" type="text" value={formData.name} onChange={handleChange} placeholder="Contoh: Siti Aminah" className="mt-2 w-full border-2 border-[#18181B] bg-[#FFFDF7] px-4 py-3 text-sm font-medium text-[#18181B] outline-none transition-all focus:shadow-[4px_4px_0px_#7F1D1D] placeholder:text-[#18181B]/40 dark:border-[#FFFDF7] dark:bg-[#18181B] dark:text-[#FFFDF7] dark:focus:shadow-[4px_4px_0px_#C9A227] dark:placeholder:text-[#FFFDF7]/40" /></label>
              <label className="block"><span className="text-sm font-black text-[#18181B] dark:text-[#FFFDF7]">Nomor WhatsApp</span><input required name="whatsapp" type="tel" value={formData.whatsapp} onChange={handleChange} placeholder="Contoh: 0857xxxxxxxx" className="mt-2 w-full border-2 border-[#18181B] bg-[#FFFDF7] px-4 py-3 text-sm font-medium text-[#18181B] outline-none transition-all focus:shadow-[4px_4px_0px_#7F1D1D] placeholder:text-[#18181B]/40 dark:border-[#FFFDF7] dark:bg-[#18181B] dark:text-[#FFFDF7] dark:focus:shadow-[4px_4px_0px_#C9A227] dark:placeholder:text-[#FFFDF7]/40" /></label>
              <div><p className="text-sm font-black text-[#18181B] dark:text-[#FFFDF7]">Tipe Pesanan</p><div className="mt-2 grid gap-3 sm:grid-cols-3">{(['Makan di Tempat', 'Pick Up', 'Delivery'] as OrderType[]).map((type) => (<label key={type} className={`flex cursor-pointer items-center gap-3 border-2 border-[#18181B] bg-[#FFFDF7] px-4 py-3 text-sm font-black transition-all dark:border-[#FFFDF7] dark:bg-[#18181B] dark:text-[#FFFDF7] ${formData.orderType === type ? 'shadow-[4px_4px_0px_#7F1D1D] border-[#7F1D1D] dark:border-[#C9A227] dark:shadow-[4px_4px_0px_#C9A227]' : 'hover:bg-[#C9A227]/10 dark:hover:bg-[#C9A227]/20'}`}><input type="radio" name="orderType" value={type} checked={formData.orderType === type} onChange={handleChange} className="h-4 w-4 accent-[#7F1D1D] dark:accent-[#C9A227]" />{type}</label>))}</div></div>
              <div><p className="text-sm font-black text-[#18181B] dark:text-[#FFFDF7]">Metode Pembayaran</p>{isDelivery && <div className="mt-2 mb-3 flex gap-2 items-start border-2 border-blue-500/30 bg-blue-500/10 p-3 text-blue-600 dark:text-blue-300 dark:bg-blue-500/20 dark:border-blue-500/50"><Info className="mt-0.5 h-4 w-4 shrink-0" /><p className="text-xs font-bold leading-relaxed">Pesanan Delivery hanya mendukung pembayaran QRIS/online.</p></div>}<div className="mt-2 grid grid-cols-2 gap-3"><button type="button" onClick={() => setPaymentMethod('CASH')} disabled={isDelivery} className={`flex flex-col items-center justify-center gap-2 border-2 border-[#18181B] bg-[#FFFDF7] px-4 py-3 text-sm font-black transition-all dark:border-[#FFFDF7] dark:bg-[#18181B] dark:text-[#FFFDF7] ${isDelivery ? 'cursor-not-allowed opacity-40' : formData.paymentMethod === 'CASH' ? 'shadow-[4px_4px_0px_#7F1D1D] border-[#7F1D1D] dark:border-[#C9A227] dark:shadow-[4px_4px_0px_#C9A227]' : 'hover:bg-[#C9A227]/10 dark:hover:bg-[#C9A227]/20'}`}><Banknote className="h-5 w-5" />Bayar di Kasir</button><button type="button" onClick={() => setPaymentMethod('QRIS')} className={`flex flex-col items-center justify-center gap-2 border-2 border-[#18181B] bg-[#FFFDF7] px-4 py-3 text-sm font-black transition-all dark:border-[#FFFDF7] dark:bg-[#18181B] dark:text-[#FFFDF7] ${formData.paymentMethod === 'QRIS' ? 'shadow-[4px_4px_0px_#7F1D1D] border-[#7F1D1D] dark:border-[#C9A227] dark:shadow-[4px_4px_0px_#C9A227]' : 'hover:bg-[#C9A227]/10 dark:hover:bg-[#C9A227]/20'}`}><QrCode className="h-5 w-5" />QRIS / Online</button></div></div>
              <div className={`overflow-hidden transition-all duration-300 ease-out ${isDineIn ? 'max-h-36 opacity-100' : 'pointer-events-none max-h-0 opacity-0'}`} aria-hidden={!isDineIn}><label className="block pt-1"><span className="text-sm font-black text-[#18181B] dark:text-[#FFFDF7]">Nomor Meja</span><input required={isDineIn} disabled={!isDineIn} name="tableNumber" type="text" value={formData.tableNumber} onChange={handleChange} placeholder="Contoh: Meja 12" className="mt-2 w-full border-2 border-[#18181B] bg-[#FFFDF7] px-4 py-3 text-sm font-medium text-[#18181B] outline-none transition-all focus:shadow-[4px_4px_0px_#7F1D1D] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#FFFDF7] dark:bg-[#18181B] dark:text-[#FFFDF7] dark:focus:shadow-[4px_4px_0px_#C9A227] dark:disabled:text-[#FFFDF7]/60 placeholder:text-[#18181B]/40 dark:placeholder:text-[#FFFDF7]/40" /></label></div>
              <div className={`overflow-hidden transition-all duration-300 ease-out ${isDelivery ? 'max-h-[30rem] opacity-100' : 'pointer-events-none max-h-0 opacity-0'}`} aria-hidden={!isDelivery}><div className="pt-1"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><label htmlFor="deliveryAddress" className="text-sm font-black text-[#18181B] dark:text-[#FFFDF7]">Alamat Pengantaran</label><button type="button" onClick={handleUseCurrentLocation} disabled={!isDelivery || isLocating} className={`inline-flex w-full items-center justify-center gap-2 border-2 border-[#18181B] bg-[#FFFDF7] px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto dark:border-[#FFFDF7] dark:bg-[#18181B] dark:text-[#FFFDF7] dark:disabled:text-[#FFFDF7]/60 ${!isDelivery || isLocating ? '' : 'shadow-[4px_4px_0px_#18181B] transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[6px_6px_0px_#18181B] dark:shadow-[4px_4px_0px_#FFFDF7] dark:hover:shadow-[6px_6px_0px_#FFFDF7]'}`}>{isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}{isLocating ? 'Mengambil Lokasi' : 'Gunakan Lokasi Saya'}</button></div><textarea id="deliveryAddress" required={isDelivery} disabled={!isDelivery} name="deliveryAddress" value={formData.deliveryAddress} onChange={handleChange} rows={4} placeholder="Tulis alamat lengkap, patokan, atau catatan untuk kurir" className="mt-2 w-full resize-none border-2 border-[#18181B] bg-[#FFFDF7] px-4 py-3 text-sm font-medium text-[#18181B] outline-none transition-all focus:shadow-[4px_4px_0px_#7F1D1D] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#FFFDF7] dark:bg-[#18181B] dark:text-[#FFFDF7] dark:focus:shadow-[4px_4px_0px_#C9A227] dark:disabled:text-[#FFFDF7]/60 placeholder:text-[#18181B]/40 dark:placeholder:text-[#FFFDF7]/40" />{locationFeedback && <p className={`mt-2 border-2 px-3 py-2 text-xs font-bold leading-5 ${locationFeedback.type === 'success' ? 'border-[#065F46] bg-[#065F46]/10 text-[#065F46] dark:border-[#34D399] dark:bg-[#065F46]/25 dark:text-[#34D399]' : locationFeedback.type === 'warning' ? 'border-[#C9A227] bg-[#C9A227]/10 text-[#7F1D1D] dark:border-[#C9A227] dark:bg-[#C9A227]/15 dark:text-[#C9A227]' : 'border-[#7F1D1D] bg-[#7F1D1D]/10 text-[#7F1D1D] dark:border-[#C9A227] dark:bg-[#7F1D1D]/30 dark:text-[#FFFDF7]'}`}>{locationFeedback.message}</p>}</div></div>
              <label className="block"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm font-black text-[#18181B] dark:text-[#FFFDF7]">Catatan Pesanan</span><span className="text-xs font-bold text-[#18181B]/50 dark:text-[#FFFDF7]/50">{remainingOrderNoteCharacters} karakter tersisa</span></div><textarea name="orderNotes" value={formData.orderNotes} onChange={handleChange} rows={4} maxLength={ORDER_NOTES_MAX_LENGTH} placeholder="Tambahkan catatan untuk pesanan Anda (opsional)" className="mt-2 w-full resize-none border-2 border-[#18181B] bg-[#FFFDF7] px-4 py-3 text-sm font-medium text-[#18181B] outline-none transition-all focus:shadow-[4px_4px_0px_#7F1D1D] dark:border-[#FFFDF7] dark:bg-[#18181B] dark:text-[#FFFDF7] dark:focus:shadow-[4px_4px_0px_#C9A227] placeholder:text-[#18181B]/40 dark:placeholder:text-[#FFFDF7]/40" /></label>
              {submitError && <div className="border-2 border-[#7F1D1D] bg-[#7F1D1D]/10 px-4 py-3 text-sm font-bold text-[#7F1D1D] dark:border-[#C9A227] dark:bg-[#7F1D1D]/30 dark:text-[#FFFDF7]">{submitError}</div>}
              <button type="submit" disabled={cart.length === 0 || orderMutation.isPending} className="inline-flex items-center justify-center gap-2 bg-[#7F1D1D] px-5 py-3 text-sm font-black text-[#FFFDF7] border-4 border-[#18181B] shadow-[6px_6px_0px_#18181B] transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[10px_10px_0px_#18181B] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none dark:border-[#FFFDF7] dark:shadow-[6px_6px_0px_#FFFDF7] dark:hover:shadow-[10px_10px_0px_#FFFDF7]">{orderMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Kirim Pesanan{!orderMutation.isPending && <ArrowRight className="h-4 w-4" />}</button>
            </div>
          </form>
          <aside className="border-4 border-[#18181B] bg-[#FFFDF7] p-6 shadow-[8px_8px_0px_#18181B] lg:sticky lg:top-24 lg:self-start dark:border-[#FFFDF7] dark:bg-[#18181B] dark:shadow-[8px_8px_0px_#FFFDF7]">
            <div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-black text-[#18181B] dark:text-[#FFFDF7]">Ringkasan Keranjang</h2><p className="mt-1 text-sm font-bold text-[#18181B]/70 dark:text-[#FFFDF7]/70">{totalItems} item dipilih</p></div><div className="flex h-11 w-11 items-center justify-center border-2 border-[#18181B] bg-[#C9A227] shadow-[3px_3px_0px_#18181B] dark:border-[#FFFDF7]"><ShoppingBag className="h-5 w-5 text-[#18181B]" /></div></div>
            {cart.length === 0 ? <EmptyState compact title="Keranjang kosong" description="Pilih menu terlebih dahulu agar ringkasan pesanan muncul di sini." /> : <><div className="mt-6 space-y-4">{cart.map((item) => (<div key={item.id} className="border-2 border-[#18181B] bg-[#FFFDF7] p-3 shadow-[4px_4px_0px_#18181B] dark:border-[#FFFDF7] dark:bg-[#18181B] dark:shadow-[4px_4px_0px_#FFFDF7]"><div className="flex gap-3"><img src={item.imageUrl || PLACEHOLDER_IMAGE} alt={item.name} className="h-16 w-16 border-2 border-[#18181B] object-cover dark:border-[#FFFDF7]" onError={(event) => { event.currentTarget.src = PLACEHOLDER_IMAGE; }} /><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-black text-[#18181B] dark:text-[#FFFDF7]">{item.name}</h3><p className="mt-1 text-sm font-black text-[#7F1D1D] dark:text-[#C9A227]">{formatRupiah(item.price)}</p></div><button type="button" onClick={() => removeFromCart(item.id)} className="flex h-8 w-8 items-center justify-center border-2 border-[#18181B] bg-[#FFFDF7] text-[#18181B]/70 transition-colors hover:bg-[#7F1D1D]/10 dark:border-[#FFFDF7] dark:bg-[#18181B] dark:text-[#FFFDF7]/70 dark:hover:bg-[#C9A227]/15" aria-label={`Hapus ${item.name}`}><Trash2 className="h-4 w-4" /></button></div><div className="mt-3 flex items-center justify-between gap-3"><div className="inline-flex items-center border-2 border-[#18181B] bg-[#FFFDF7] dark:border-[#FFFDF7] dark:bg-[#18181B]"><button type="button" onClick={() => decreaseQuantity(item.id)} className="flex h-9 w-9 items-center justify-center text-[#18181B] transition-colors hover:bg-[#C9A227]/10 dark:text-[#FFFDF7] dark:hover:bg-[#C9A227]/15" aria-label={`Kurangi ${item.name}`}><Minus className="h-4 w-4" /></button><span className="w-10 text-center text-sm font-black text-[#18181B] dark:text-[#FFFDF7]">{item.quantity}</span><button type="button" onClick={() => increaseQuantity(item.id)} disabled={item.quantity >= item.stock} className="flex h-9 w-9 items-center justify-center text-[#18181B] transition-colors hover:bg-[#C9A227]/10 disabled:cursor-not-allowed disabled:text-[#18181B]/25 dark:text-[#FFFDF7] dark:hover:bg-[#C9A227]/15 dark:disabled:text-[#FFFDF7]/25" aria-label={`Tambah ${item.name}`}><Plus className="h-4 w-4" /></button></div><p className="text-sm font-black text-[#18181B] dark:text-[#FFFDF7]">{formatRupiah(item.price * item.quantity)}</p></div></div>))}</div><div className="mt-6 border-t-2 border-[#18181B] pt-5 dark:border-[#FFFDF7]"><div className="flex items-center justify-between text-sm font-bold text-[#18181B]/70 dark:text-[#FFFDF7]/70"><span>Subtotal</span><span>{formatRupiah(totalAmount)}</span></div><div className="mt-3 flex items-center justify-between text-lg font-black text-[#18181B] dark:text-[#FFFDF7]"><span>Total</span><span>{formatRupiah(totalAmount)}</span></div></div></>}
          </aside>
        </div>
      </div>
    </section>
  );
}

// --- CHECK ORDER STATUS ---
function CheckOrderStatus() {
  const [searchInput, setSearchInput] = useState('');
  const [orderId, setOrderId] = useState('');
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);

  const { data: order, isLoading, isError, refetch } = useQuery({
    queryKey: ['orderStatus', orderId],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE_URL}/orders/${orderId}`);
      return res.data.data as OrderStatusResponse;
    },
    enabled: !!orderId,
    retry: false,
  });

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchInput.trim()) setOrderId(searchInput.trim());
  };

  const handleLanjutkanPembayaran = async (currentOrder: OrderStatusResponse) => {
    if (!orderId) return;
    
    setIsPaymentLoading(true);
    
    try {
      const res = await axios.post('http://localhost:5000/api/payments/create', {
        orderId: orderId,
        amount: currentOrder.totalAmount,
        customerName: currentOrder.customerName,
      });

      const { token } = res.data;

      if (!token) {
        alert('Gagal mendapatkan token pembayaran.');
        setIsPaymentLoading(false);
        return;
      }

      // @ts-ignore
      window.snap.pay(token, {
        onSuccess: () => {
          alert('✅ Pembayaran berhasil!');
          refetch();
        },
        onPending: () => {
          alert('⏳ Menunggu pembayaran diselesaikan.');
          refetch();
        },
        onError: () => {
          alert('❌ Pembayaran gagal.');
        },
        onClose: () => {
          alert('Anda menutup layar pembayaran sebelum selesai.');
        },
      });
    } catch (error) {
      console.error('Error:', error);
      alert('Gagal memuat ulang pembayaran.');
    }
    
    setIsPaymentLoading(false);
  };

  const progressWidth = order
    ? order.status === 'COMPLETED' ? '100%'
    : order.status === 'COOKING' ? '50%'
    : '0%'
    : '0%';

return (
    <section className="flex min-h-[calc(100vh-180px)] flex-col items-center justify-center bg-[#FFFDF7] px-4 py-16 dark:bg-[#18181B] sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="mx-auto max-w-3xl w-full space-y-8">
        <div className="space-y-4 text-center">
          <h2 className="text-3xl font-black tracking-tight text-[#18181B] dark:text-[#FFFDF7]">Lacak Pesanan</h2>
          <p className="font-bold text-[#18181B]/70 dark:text-[#FFFDF7]/70">Masukkan ID Pesanan Anda untuk melihat status saat ini.</p>
          <form onSubmit={handleSearch} className="relative mx-auto flex max-w-md items-center">
            <input
              type="text"
              placeholder="Contoh: 123e4567-e89b-12d3..."
              className="w-full border-2 border-[#18181B] bg-[#FFFDF7] px-4 py-3.5 pr-14 text-sm font-mono font-bold text-[#18181B] outline-none transition-all focus:shadow-[4px_4px_0px_#7F1D1D] placeholder:text-[#18181B]/40 dark:border-[#FFFDF7] dark:bg-[#18181B] dark:text-[#FFFDF7] dark:focus:shadow-[4px_4px_0px_#C9A227] dark:placeholder:text-[#FFFDF7]/40"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button
              type="submit"
              className="absolute right-2 bg-[#7F1D1D] p-2 text-[#FFFDF7] border-2 border-[#18181B] shadow-[4px_4px_0px_#18181B] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#18181B] dark:border-[#FFFDF7] dark:shadow-[4px_4px_0px_#FFFDF7] dark:hover:shadow-[6px_6px_0px_#FFFDF7]"
            >
              <Search className="h-5 w-5" />
            </button>
          </form>
        </div>

        {!orderId && !isLoading && !isError && (
          <div className="border-4 border-dashed border-[#18181B]/20 bg-[#FFFDF7] p-12 text-center dark:border-[#FFFDF7]/20 dark:bg-[#18181B]">
            <Search className="mx-auto h-12 w-12 text-[#18181B]/20 dark:text-[#FFFDF7]/20" />
            <p className="mt-4 text-sm font-bold text-[#18181B]/50 dark:text-[#FFFDF7]/50">Masukkan ID pesanan untuk melihat status</p>
          </div>
        )}

        {isLoading && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#7F1D1D] border-t-transparent dark:border-[#C9A227] dark:border-t-transparent" />
            <p className="text-center font-bold text-[#18181B]/70 dark:text-[#FFFDF7]/70">Mencari pesanan...</p>
          </div>
        )}

        {isError && (
          <div className="mx-auto mt-8 max-w-md border-2 border-[#7F1D1D] bg-[#7F1D1D]/10 p-5 text-center dark:border-[#C9A227] dark:bg-[#7F1D1D]/20">
            <AlertCircle className="mx-auto h-8 w-8 text-[#7F1D1D] dark:text-[#FFFDF7]" />
            <p className="mt-2 text-sm font-bold text-[#7F1D1D] dark:text-[#FFFDF7]">Pesanan Tidak Ditemukan</p>
            <p className="text-xs font-bold opacity-80 text-[#7F1D1D] dark:text-[#FFFDF7]">Pastikan ID Pesanan yang Anda masukkan sudah benar dan utuh.</p>
          </div>
        )}

        {order && (
          <div className="border-4 border-[#18181B] bg-[#FFFDF7] p-6 shadow-[8px_8px_0px_#18181B] dark:border-[#FFFDF7] dark:bg-[#18181B] dark:shadow-[8px_8px_0px_#FFFDF7]">
            <div className="flex flex-col gap-4 border-b-2 border-[#18181B] pb-6 dark:border-[#FFFDF7] md:flex-row md:justify-between">
              <div>
                <p className="mb-1 text-xs font-black uppercase tracking-wider text-[#18181B]/50 dark:text-[#FFFDF7]/50">Nama Pemesan</p>
                <p className="text-lg font-black text-[#18181B] dark:text-[#FFFDF7]">{order.customerName || 'Pelanggan'}</p>
              </div>
              <div className="md:text-right">
                <p className="mb-1 text-xs font-black uppercase tracking-wider text-[#18181B]/50 dark:text-[#FFFDF7]/50">Waktu Pesan</p>
                <p className="text-sm font-bold text-[#18181B]/70 dark:text-[#FFFDF7]/70">{new Date(order.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </div>
            </div>

            <div className="py-4">
              <p className="mb-6 text-center text-xs font-black uppercase tracking-wider text-[#18181B]/50 dark:text-[#FFFDF7]/50">Status Dapur</p>
              <div className="relative mx-auto flex max-w-md items-center justify-between">
                <div className="absolute left-0 top-1/2 -z-10 h-2 w-full -translate-y-1/2 bg-[#18181B]/20 dark:bg-[#FFFDF7]/20">
                  <div className="h-full bg-[#065F46] transition-all duration-700 dark:bg-[#34D399]" style={{ width: order.status === 'CANCELLED' ? '0%' : progressWidth }} />
                </div>
                <div className="flex flex-col items-center gap-2 px-2">
                  <div className={`flex h-10 w-10 items-center justify-center border-2 border-[#18181B] dark:border-[#FFFDF7] ${['PENDING', 'COOKING', 'COMPLETED'].includes(order.status) ? 'bg-[#C9A227] text-[#18181B] shadow-[3px_3px_0px_#18181B] dark:shadow-[3px_3px_0px_#FFFDF7]' : 'bg-[#FFFDF7] text-[#18181B]/40 dark:bg-[#18181B] dark:text-[#FFFDF7]/30'}`}>
                    <Clock className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-bold text-[#18181B]/70 dark:text-[#FFFDF7]/70">Menunggu</span>
                </div>
                <div className="flex flex-col items-center gap-2 px-2">
                  <div className={`flex h-10 w-10 items-center justify-center border-2 border-[#18181B] dark:border-[#FFFDF7] ${['COOKING', 'COMPLETED'].includes(order.status) ? 'bg-[#7F1D1D] text-[#FFFDF7] shadow-[3px_3px_0px_#18181B] dark:shadow-[3px_3px_0px_#FFFDF7]' : 'bg-[#FFFDF7] text-[#18181B]/40 dark:bg-[#18181B] dark:text-[#FFFDF7]/30'}`}>
                    <ChefHat className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-bold text-[#18181B]/70 dark:text-[#FFFDF7]/70">Dimasak</span>
                </div>
                <div className="flex flex-col items-center gap-2 px-2">
                  <div className={`flex h-10 w-10 items-center justify-center border-2 border-[#18181B] dark:border-[#FFFDF7] ${order.status === 'COMPLETED' ? 'bg-[#065F46] text-[#FFFDF7] shadow-[3px_3px_0px_#18181B] dark:shadow-[3px_3px_0px_#FFFDF7]' : 'bg-[#FFFDF7] text-[#18181B]/40 dark:bg-[#18181B] dark:text-[#FFFDF7]/30'}`}>
                    <PackageCheck className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-bold text-[#18181B]/70 dark:text-[#FFFDF7]/70">Selesai</span>
                </div>
              </div>
              {order.status === 'CANCELLED' && (
                <div className="mt-6 flex items-center justify-center gap-2 border-2 border-[#7F1D1D] bg-[#7F1D1D]/10 p-3 text-center text-sm font-bold text-[#7F1D1D] dark:border-[#C9A227] dark:bg-[#7F1D1D]/20 dark:text-[#FFFDF7]">
                  <AlertCircle className="h-4 w-4" />Mohon maaf, pesanan ini telah dibatalkan.
                </div>
              )}
            </div>

            <div className="border-2 border-[#18181B] bg-[#FFFDF7] p-4 shadow-[4px_4px_0px_#18181B] dark:border-[#FFFDF7] dark:bg-[#18181B] dark:shadow-[4px_4px_0px_#FFFDF7]">
              <h4 className="mb-3 text-sm font-black uppercase tracking-wider text-[#18181B]/50 dark:text-[#FFFDF7]/50">Rincian Menu</h4>
              <ul className="space-y-2">
                {order.items.map((item, idx) => (
                  <li key={idx} className={`flex justify-between border-t-2 border-[#18181B]/20 pt-2 text-sm font-bold first:border-t-0 first:pt-0 dark:border-[#FFFDF7]/20`}>
                    <span className="text-[#18181B]/70 dark:text-[#FFFDF7]/70">
                      <span className="font-black text-[#18181B] dark:text-[#FFFDF7]">{item.quantity}x</span> {item.menu.name}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex justify-between border-t-2 border-[#18181B] pt-3 font-black dark:border-[#FFFDF7]">
                <span className="text-[#18181B] dark:text-[#FFFDF7]">Total Bayar</span>
                <span className="text-[#7F1D1D] dark:text-[#C9A227]">Rp {order.totalAmount.toLocaleString('id-ID')}</span>
              </div>
            </div>

            {(order.status === 'PENDING' || order.status === 'PENDING_PAYMENT') && (
  <div className="mt-6 border-2 border-[#C9A227] bg-[#C9A227]/10 p-4 dark:border-[#C9A227] dark:bg-[#C9A227]/15">
    <p className="text-sm font-bold text-[#18181B] dark:text-[#FFFDF7]">
      ⚠️ Pesanan Anda belum dibayar.
    </p>
    <p className="mt-1 text-xs font-bold text-[#18181B]/70 dark:text-[#FFFDF7]/70">
      Selesaikan pembayaran Anda menggunakan QRIS atau metode lainnya agar pesanan dapat segera diproses oleh dapur.
    </p>
    <button
      type="button"
      onClick={() => handleLanjutkanPembayaran(order)}
      disabled={isPaymentLoading}
      className="mt-4 inline-flex w-full items-center justify-center gap-2 bg-[#7F1D1D] px-5 py-3 text-sm font-black text-[#FFFDF7] border-4 border-[#18181B] shadow-[6px_6px_0px_#18181B] transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[10px_10px_0px_#18181B] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#FFFDF7] dark:shadow-[6px_6px_0px_#FFFDF7] dark:hover:shadow-[10px_10px_0px_#FFFDF7]"
    >
      {isPaymentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
      {isPaymentLoading ? 'Memproses...' : 'Lanjutkan Pembayaran'}
    </button>
  </div>
)}
          </div>
        )}
      </div>
    </section>
  );
}

// --- SHELL ---
function Shell() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FFFDF7] dark:bg-[#18181B] transition-colors duration-300">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/status" element={<CheckOrderStatus />} />
          <Route path="/tentang" element={<AboutPage />} />
          <Route path="/kontak" element={<ContactPage />} />
          <Route path="/pesan" element={<CheckoutPage />} />
        </Routes>
      </main>
      <FloatingCartButton />
      <Footer />
    </div>
  );
}

// --- APP ENTRY ---
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CartProvider>
          <BrowserRouter>
            <Shell />
          </BrowserRouter>
        </CartProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}