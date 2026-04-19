/**
 * 项目列表页 — V2 骨架
 *
 * V2 只有两个页面：/ (项目列表) 和 /projects/:id (主工作页)
 * 详细实现将在 SDD Spec 完成后进行。
 */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between h-14 px-6 bg-white border-b border-border">
        <h1 className="text-lg font-semibold text-primary font-serif">墨染 MoRan</h1>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center py-20">
          <h2 className="text-2xl font-semibold text-primary font-serif">V2 开发中</h2>
          <p className="mt-2 text-muted-foreground">
            项目列表页将在 SDD Spec 完成后实现。
          </p>
        </div>
      </main>
    </div>
  );
}
