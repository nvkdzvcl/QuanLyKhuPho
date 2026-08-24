'use client';

import React from 'react';

interface PublicLandingProps {
  onOpenAuth: () => void;
}

type LandingIconName =
  | 'home'
  | 'bell'
  | 'file'
  | 'user'
  | 'logout'
  | 'lock'
  | 'shield'
  | 'devices'
  | 'phone'
  | 'message'
  | 'people'
  | 'lightning'
  | 'megaphone'
  | 'leaf'
  | 'menu'
  | 'chevron';

function LandingIcon({ name, className = 'h-5 w-5' }: { name: LandingIconName; className?: string }) {
  const shared = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

  switch (name) {
    case 'home':
      return <svg {...shared}><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-7h6v7" /></svg>;
    case 'bell':
      return <svg {...shared}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>;
    case 'file':
      return <svg {...shared}><path d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></svg>;
    case 'user':
      return <svg {...shared}><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2" /></svg>;
    case 'logout':
      return <svg {...shared}><path d="M10 17l5-5-5-5M15 12H3M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /></svg>;
    case 'lock':
      return <svg {...shared}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
    case 'shield':
      return <svg {...shared}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>;
    case 'devices':
      return <svg {...shared}><rect x="2" y="4" width="13" height="10" rx="2" /><path d="M6 20h5M8.5 14v6" /><rect x="17" y="8" width="5" height="11" rx="1" /></svg>;
    case 'phone':
      return <svg {...shared}><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M10 5h4M11 19h2" /></svg>;
    case 'message':
      return <svg {...shared}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" /><path d="M8 9h8M8 13h5" /></svg>;
    case 'people':
      return <svg {...shared}><circle cx="9" cy="8" r="4" /><path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" /><path d="M17 4.5a4 4 0 0 1 0 7.5M19 14a5 5 0 0 1 3 4.6V21" /></svg>;
    case 'lightning':
      return <svg {...shared}><path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" /></svg>;
    case 'megaphone':
      return <svg {...shared}><path d="m3 11 18-5v12L3 14v-3Z" /><path d="M6 15.5 7.5 21h4l-1.2-4.4" /></svg>;
    case 'leaf':
      return <svg {...shared}><path d="M20 4C12 4 5 7 5 14c0 3 2 5 5 5 7 0 10-7 10-15Z" /><path d="M4 21c2-5 6-9 12-12" /></svg>;
    case 'menu':
      return <svg {...shared}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
    case 'chevron':
    default:
      return <svg {...shared}><path d="m9 18 6-6-6-6" /></svg>;
  }
}

function BrandMark({ className = 'h-12 w-12' }: { className?: string }) {
  return (
    <span className={`relative flex shrink-0 items-center justify-center text-blue-600 ${className}`} aria-hidden="true">
      <svg viewBox="0 0 52 52" fill="none" className="h-full w-full">
        <path d="M4 22 26 4l22 18v25H4V22Z" fill="currentColor" />
        <path d="M10 24 26 11l16 13v17H10V24Z" fill="white" />
        <circle cx="20" cy="25" r="4" fill="currentColor" />
        <circle cx="32" cy="25" r="4" fill="currentColor" />
        <path d="M13 39v-2a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v2M25 39v-2a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v2" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}

const previewAnnouncements = [
  { title: 'Lịch cắt điện định kỳ', meta: 'Khu phố 3, phường An Phú', time: '08:00, 25/05/2025', icon: 'lightning' as const, tone: 'bg-amber-50 text-amber-600' },
  { title: 'Thông báo ra quân tổng vệ sinh', meta: 'Cả khu phố', time: '07:30, 28/05/2025', icon: 'megaphone' as const, tone: 'bg-blue-50 text-blue-600' },
  { title: 'Hướng dẫn phân loại rác thải', meta: 'Cả khu phố', time: '09:00, 30/05/2025', icon: 'leaf' as const, tone: 'bg-emerald-50 text-emerald-600' },
];

const previewPetitions = [
  { title: 'Đèn đường không sáng', meta: 'Tuyến đường số 5', date: 'Ngày gửi: 20/05/2025', status: 'Đang xử lý', statusClass: 'bg-amber-50 text-amber-700' },
  { title: 'Nắp cống bị hư', meta: 'Trước nhà số 12', date: 'Ngày gửi: 15/05/2025', status: 'Đã phản hồi', statusClass: 'bg-emerald-50 text-emerald-700' },
];

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[900px]" aria-label="Bản xem trước giao diện Quản lý Khu phố">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:rounded-[14px] md:shadow-[0_24px_70px_rgba(30,64,175,0.14)]">
        <div className="grid md:min-h-[430px] md:grid-cols-[140px_1fr] xl:grid-cols-[150px_1fr]">
          <aside className="hidden border-r border-slate-200 bg-white p-4 md:flex md:flex-col" aria-hidden="true">
            <div className="flex items-center gap-2 text-xs font-extrabold text-slate-950"><BrandMark className="h-7 w-7" /> Quản lý Khu phố</div>
            <div className="mt-6 space-y-2 text-[11px] font-medium">
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-blue-700"><LandingIcon name="home" className="h-4 w-4" /> Trang chủ</div>
              <div className="flex items-center gap-2 px-3 py-2.5 text-slate-600"><LandingIcon name="bell" className="h-4 w-4" /> Thông báo</div>
              <div className="flex items-center gap-2 px-3 py-2.5 text-slate-600"><LandingIcon name="file" className="h-4 w-4" /> Kiến nghị</div>
              <div className="flex items-center gap-2 px-3 py-2.5 text-slate-600"><LandingIcon name="user" className="h-4 w-4" /> Tài khoản</div>
            </div>
            <div className="mt-auto flex items-center gap-2 px-3 py-2 text-[10px] text-slate-500"><LandingIcon name="logout" className="h-4 w-4" /> Đăng xuất</div>
          </aside>

          <div className="grid gap-3 bg-slate-50/60 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[1.05fr_0.95fr] xl:p-5">
            <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label="Thông báo mới nhất">
              <div className="flex items-center justify-between gap-2"><h3 className="text-base font-extrabold text-slate-950">Thông báo mới nhất</h3><span className="text-xs font-semibold text-blue-600">Xem tất cả</span></div>
              <div className="mt-3 divide-y divide-slate-200 sm:mt-4 sm:space-y-3 sm:divide-y-0">
                {previewAnnouncements.map((item, index) => (
                  <div key={item.title} className={`items-center gap-3 py-3 first:pt-0 last:pb-0 sm:rounded-xl sm:border sm:border-slate-200 sm:p-3 ${index === 2 ? 'hidden sm:flex' : 'flex'}`}>
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.tone}`}><LandingIcon name={item.icon} className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-slate-950 sm:text-sm">{item.title}</span><span className="mt-1 block truncate text-[10px] text-slate-500">{item.meta}</span><span className="mt-0.5 block text-[10px] text-slate-500">{item.time}</span></span>
                    <LandingIcon name="chevron" className="h-4 w-4 shrink-0 text-slate-400" />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label="Kiến nghị của tôi">
              <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-extrabold text-slate-950 sm:text-base">Kiến nghị của tôi</h3><span className="text-[10px] font-semibold text-blue-600">Xem tất cả</span></div>
              <div className="mt-3 space-y-3 sm:mt-4">
                {previewPetitions.map((item, index) => (
                  <div key={item.title} className={`rounded-xl border border-slate-200 p-4 ${index === 1 ? 'hidden sm:block' : ''}`}>
                    <div className="flex items-start justify-between gap-2"><span className="text-xs font-bold text-slate-950 sm:text-sm">{item.title}</span><LandingIcon name="chevron" className="h-4 w-4 shrink-0 text-slate-400" /></div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] text-slate-500">{item.meta}</span><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${item.statusClass}`}>{item.status}</span></div>
                    <p className="mt-3 text-[10px] text-slate-500">{item.date}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

const trustItems = [
  { label: 'Xác thực OTP qua SMS', compactLabel: 'OTP an toàn', icon: 'message' as const, className: 'text-blue-600' },
  { label: 'Bảo vệ dữ liệu cá nhân', compactLabel: 'Bảo vệ dữ liệu', icon: 'shield' as const, className: 'text-emerald-600' },
  { label: 'Sử dụng trên mọi thiết bị', compactLabel: 'Mọi thiết bị', icon: 'devices' as const, className: 'text-blue-600' },
];

const steps = [
  { title: 'Nhập số điện thoại', description: 'Nhập số điện thoại của bạn để bắt đầu.', icon: 'phone' as const },
  { title: 'Xác thực mã OTP', description: 'Nhận mã OTP qua SMS và xác thực nhanh chóng.', icon: 'message' as const },
  { title: 'Truy cập hệ thống', description: 'Truy cập và sử dụng các tính năng phù hợp.', icon: 'people' as const },
];

const compactSteps = ['Số điện thoại', 'Mã OTP', 'Hoàn tất'];

function CompactSteps() {
  return (
    <section id="mobile-quick-start" className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-4 lg:hidden" aria-labelledby="mobile-quick-start-title">
      <h2 id="mobile-quick-start-title" className="text-lg font-extrabold text-blue-950">Bắt đầu nhanh</h2>
      <ol className="mt-4 grid grid-cols-3">
        {compactSteps.map((step, index) => (
          <li key={step} className="relative flex min-w-0 flex-col items-center text-center">
            {index > 0 && <span className="absolute right-1/2 top-3.5 h-px w-full bg-blue-200" aria-hidden="true" />}
            <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-extrabold text-white">{index + 1}</span>
            <span className="mt-2 text-[11px] font-semibold leading-4 text-slate-700 sm:text-xs">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function PublicLanding({ onOpenAuth }: PublicLandingProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-[1540px] items-center justify-between gap-4 px-4 sm:min-h-[76px] sm:px-6 lg:px-10">
          <a href="#main-content" className="flex min-w-0 items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" aria-label="Quản lý Khu phố - về nội dung chính">
            <BrandMark className="h-9 w-9 sm:h-12 sm:w-12" />
            <span className="min-w-0"><span className="block truncate text-sm font-extrabold uppercase tracking-[0.02em] text-slate-950 min-[360px]:text-base sm:text-xl">Quản lý Khu phố</span><span className="hidden truncate text-xs text-slate-500 sm:block">Cổng thông tin phục vụ cộng đồng</span></span>
          </a>
          <div className="flex shrink-0 items-center gap-3 sm:gap-6">
            <a href="#how-it-works" className="hidden rounded-lg px-2 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 md:inline-flex">Cách hoạt động</a>
            <button type="button" onClick={onOpenAuth} className="hidden rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition duration-200 hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:inline-flex">
              Đăng nhập / Đăng ký
            </button>
            <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-blue-600 transition hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:hidden" aria-label="Mở trình đơn" aria-controls="mobile-navigation" aria-expanded={isMobileMenuOpen} onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}><LandingIcon name="menu" className="h-6 w-6" /></button>
          </div>
        </div>
        {isMobileMenuOpen && (
          <nav id="mobile-navigation" className="absolute inset-x-0 top-full border-b border-slate-200 bg-white p-4 shadow-lg sm:hidden" aria-label="Điều hướng di động">
            <div className="mx-auto grid max-w-lg gap-2">
              <a href="#mobile-quick-start" onClick={() => setIsMobileMenuOpen(false)} className="flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cách hoạt động</a>
              <button type="button" onClick={() => { setIsMobileMenuOpen(false); onOpenAuth(); }} className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white">Đăng nhập / Đăng ký</button>
            </div>
          </nav>
        )}
      </header>

      <main id="main-content">
        <section className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-b from-white to-blue-50/30">
          <svg className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[63%] text-blue-100/60 lg:block" viewBox="0 0 1000 660" fill="none" aria-hidden="true">
            <path d="M0 590h1000M80 590V360l120-85 105 74 86-59 145 104v196M590 590V310h150v280M655 310V205l104-66 101 65v386M785 590V350h150v240" stroke="currentColor" strokeWidth="2" />
            <path d="M677 590V375h62v215M818 590V415h70v175M120 590V420h68v170M340 590V432h88v158" stroke="currentColor" strokeWidth="2" />
            <path d="M40 155c205-104 392-90 555-13 126 59 239 58 405-15" stroke="currentColor" strokeDasharray="8 10" />
          </svg>

          <div className="relative mx-auto grid w-full max-w-[1540px] items-center gap-6 px-4 py-7 sm:gap-10 sm:px-6 sm:py-16 lg:grid-cols-[0.82fr_1.18fr] lg:gap-8 lg:px-10 lg:py-20 xl:gap-12">
            <div className="max-w-2xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-blue-600 sm:text-sm">Cổng thông tin khu phố</p>
              <h1 className="mt-3 text-[2rem] font-extrabold leading-[1.1] tracking-tight text-blue-950 min-[390px]:text-[2.15rem] sm:mt-5 sm:text-5xl sm:leading-[1.12] lg:text-[3.25rem] xl:text-[3.5rem]">Kết nối cộng đồng, phục vụ người dân thuận tiện hơn</h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600 sm:mt-5 sm:text-lg sm:leading-7"><span className="sm:hidden">Nhận thông báo chính thức, gửi kiến nghị và theo dõi tiến độ xử lý an toàn, minh bạch.</span><span className="hidden sm:inline">Nhận thông báo chính thức, gửi kiến nghị và theo dõi tiến độ xử lý trên một nền tảng an toàn, minh bạch.</span></p>

              <div className="mt-5 flex flex-col gap-3 sm:mt-7 sm:max-w-[430px]">
                <button type="button" onClick={onOpenAuth} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-600/15 transition duration-200 hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:text-base"><LandingIcon name="lock" className="h-5 w-5" />Đăng nhập / Đăng ký bằng OTP</button>
                <a href="#how-it-works" className="hidden min-h-12 items-center justify-center gap-2 rounded-lg border border-blue-600 bg-white px-5 py-3 text-sm font-bold text-blue-700 transition duration-200 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:inline-flex sm:text-base">Xem cách hoạt động <LandingIcon name="chevron" className="h-4 w-4" /></a>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-medium text-slate-600 sm:mt-7 sm:flex sm:flex-wrap sm:gap-x-5">
                {trustItems.map((item, index) => <div key={item.label} className={`items-center gap-2 ${index === 2 ? 'hidden sm:flex' : 'flex'}`}><LandingIcon name={item.icon} className={`h-5 w-5 ${item.className}`} /><span className="sm:hidden">{item.compactLabel}</span><span className="hidden sm:inline">{item.label}</span></div>)}
              </div>
            </div>

            <CompactSteps />
            <ProductPreview />
          </div>
        </section>

        <section id="how-it-works" className="hidden scroll-mt-24 bg-white px-4 py-10 sm:px-6 sm:py-14 lg:block lg:px-10" aria-labelledby="how-it-works-title">
          <div className="mx-auto max-w-[1450px] rounded-2xl border border-blue-100 bg-blue-50/30 px-5 py-7 sm:px-8 lg:px-12">
            <h2 id="how-it-works-title" className="text-center text-2xl font-extrabold tracking-tight text-blue-950 sm:text-3xl">Bắt đầu chỉ trong 3 bước</h2>
            <ol className="mt-7 grid gap-5 lg:grid-cols-3 lg:gap-8">
              {steps.map((step, index) => (
                <li key={step.title} className="relative flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-white text-blue-600 shadow-sm sm:h-16 sm:w-16"><LandingIcon name={step.icon} className="h-7 w-7" /></span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-extrabold text-white">{index + 1}</span>
                  <span className="min-w-0"><span className="block text-sm font-extrabold text-slate-950 sm:text-base">{step.title}</span><span className="mt-1 block text-xs leading-5 text-slate-600 sm:text-sm">{step.description}</span></span>
                  {index < steps.length - 1 && <LandingIcon name="chevron" className="absolute -right-5 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-slate-400 lg:block" />}
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 py-5">
        <div className="mx-auto flex max-w-[1540px] flex-col items-center justify-between gap-2 px-4 text-center text-xs text-slate-500 sm:flex-row sm:px-6 sm:text-left lg:px-10">
          <p>© 2026 Quản lý Khu phố</p>
          <p>Cổng thông tin phục vụ cộng đồng dân cư</p>
        </div>
      </footer>
    </div>
  );
}
