import { TopBar } from "@/components/layout/top-bar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function ManagePage() {
  return (
    <div className="flex h-full flex-col">
      <TopBar title="🗂️ 管理" description="项目全局管理、数据健康监控、成本追踪" />
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">写作进度</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>总字数</span>
                  <span className="font-mono">0</span>
                </div>
                <div className="flex justify-between">
                  <span>总章节</span>
                  <span className="font-mono">0</span>
                </div>
                <div className="flex justify-between">
                  <span>当前弧段</span>
                  <span className="font-mono">-</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">API 成本</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>总消耗</span>
                  <span className="font-mono">$0.00</span>
                </div>
                <div className="flex justify-between">
                  <span>每章均价</span>
                  <span className="font-mono">-</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">UNM 健康</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>HOT</span>
                  <span className="font-mono">0</span>
                </div>
                <div className="flex justify-between">
                  <span>WARM</span>
                  <span className="font-mono">0</span>
                </div>
                <div className="flex justify-between">
                  <span>COLD</span>
                  <span className="font-mono">0</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">伏笔追踪</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">暂无伏笔数据</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">角色管理</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">暂无角色数据</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">螺旋检测</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">暂无告警历史</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
