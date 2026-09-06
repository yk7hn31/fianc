import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Wallet } from "lucide-react";

export default function Home() {
  return (
    <main className="mx-auto max-w-[1280px] p-6 space-y-6">
      <h1 className="text-display font-semibold">fianc</h1>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-5">
          <Wallet className="size-4" strokeWidth={1.5} />
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="destructive">Delete</Button>
          <Input placeholder="Search" className="max-w-48" />
          <Badge>Tag</Badge>
        </CardContent>
      </Card>
    </main>
  );
}
