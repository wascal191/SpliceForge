import { DemoCanvasClient } from "@/components/demo/DemoCanvasClient";

export const metadata = {
  title: "SpliceForge — Live demo",
  description:
    "Try SpliceForge directly in your browser. No account required. Pan, zoom, and explore an FTTH access network.",
};

export default function DemoPage() {
  return <DemoCanvasClient />;
}
