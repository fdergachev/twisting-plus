"use client"
import dynamic from "next/dynamic";
import Image from "next/image";

const Wrapper = dynamic(() => import("./components/Scene"), { ssr: false });
export default function Home() {
   return (
      <div className="h-screen w-screen bg-background">
         <Wrapper />
      </div>
   );
}
