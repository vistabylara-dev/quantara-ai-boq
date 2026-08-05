import PublicHeader from "@/components/layout/public-header"
import PublicFooter from "@/components/layout/public-footer"

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </>
  )
}
