import PublicHeader from "@/components/layout/public-header"
import PublicFooter from "@/components/layout/public-footer"

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div data-theme="dark" className="min-h-screen bg-[#030508] text-white">
      <PublicHeader />
      <main className="flex-1 bg-[#030508]">{children}</main>
      <PublicFooter />
    </div>
  )
}
